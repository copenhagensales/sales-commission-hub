import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { action, client_id, schedule } = await req.json()
    
    if (!client_id) throw new Error("client_id es requerido")
    if (!action) throw new Error("action es requerido (activate/deactivate)")

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Nombre único del job para este cliente
    const jobName = `sync-client-${client_id}`

    if (action === 'activate') {
      console.log(`[Scheduler] Activando job: ${jobName} con schedule: ${schedule || '0 * * * *'}`)
      
      // 1. Primero intentar eliminar el job existente (ignorar error si no existe)
      try {
        await supabase.rpc('cron_unschedule', { job_name: jobName })
      } catch (e) {
        console.log(`[Scheduler] No existía job previo: ${jobName}`)
      }

      // 2. Crear el nuevo cron job
      const functionUrl = `${supabaseUrl}/functions/v1/customer-crm-syncer`
      const cronSchedule = schedule || '0 * * * *'
      
      const { error: scheduleError } = await supabase.rpc('cron_schedule', {
        job_name: jobName,
        cron_pattern: cronSchedule,
        command: `SELECT net.http_post(
          url := '${functionUrl}',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body := '{"client_id": "${client_id}"}'::jsonb
        );`
      })

      if (scheduleError) {
        console.error('[Scheduler] Error creando cron:', scheduleError)
        throw new Error(`Error creando cron: ${scheduleError.message}`)
      }

      // 3. Actualizar estado en DB
      await supabase.from('customer_integrations')
        .update({ is_active: true, cron_schedule: cronSchedule, updated_at: new Date().toISOString() })
        .eq('client_id', client_id)

      console.log(`[Scheduler] Job ${jobName} activado correctamente`)
      return new Response(
        JSON.stringify({ success: true, message: `Job ${jobName} activado`, schedule: cronSchedule }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'deactivate') {
      console.log(`[Scheduler] Desactivando job: ${jobName}`)
      
      // 1. Eliminar el cron job
      try {
        await supabase.rpc('cron_unschedule', { job_name: jobName })
      } catch (e) {
        console.log(`[Scheduler] Job no existía o ya fue eliminado`)
      }

      // 2. Actualizar estado en DB
      await supabase.from('customer_integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('client_id', client_id)

      console.log(`[Scheduler] Job ${jobName} desactivado correctamente`)
      return new Response(
        JSON.stringify({ success: true, message: `Job ${jobName} desactivado` }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'status') {
      // Obtener estado actual
      const { data: integration } = await supabase
        .from('customer_integrations')
        .select('is_active, cron_schedule, last_run_at, last_status')
        .eq('client_id', client_id)
        .single()

      return new Response(
        JSON.stringify({ success: true, integration }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error("Acción inválida. Usa: activate, deactivate, status")

  } catch (error: any) {
    console.error('[Scheduler] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
