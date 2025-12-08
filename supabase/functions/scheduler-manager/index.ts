import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, client_id } = body

    if (!client_id) throw new Error("client_id es requerido")
    if (!action) throw new Error("action es requerido (activate/deactivate/save_config/status)")

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const encryptionKey = Deno.env.get('DB_ENCRYPTION_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const jobName = `sync-client-${client_id}`

    // ============ SAVE CONFIG ============
    if (action === 'save_config') {
      const { crm_type, api_url, credentials, config, cron_schedule } = body

      if (!encryptionKey) {
        throw new Error("Server configuration error: DB_ENCRYPTION_KEY missing")
      }

      if (!crm_type) {
        throw new Error("crm_type es requerido")
      }

      console.log(`[Scheduler] Guardando configuración para cliente: ${client_id}`)

      // Call secure RPC to save encrypted credentials
      const { data: savedId, error: saveError } = await supabase.rpc('save_integration_secret', {
        p_client_id: client_id,
        p_crm_type: crm_type,
        p_api_url: api_url || null,
        p_secret_json: credentials || {},
        p_encryption_key: encryptionKey
      })

      if (saveError) {
        console.error('[Scheduler] Error guardando secret:', saveError)
        throw new Error(`Error guardando credenciales: ${saveError.message}`)
      }

      // Update non-encrypted config fields
      const { error: updateError } = await supabase
        .from('customer_integrations')
        .update({
          config: config || {},
          cron_schedule: cron_schedule || '0 * * * *',
          updated_at: new Date().toISOString()
        })
        .eq('client_id', client_id)

      if (updateError) {
        console.error('[Scheduler] Error actualizando config:', updateError)
      }

      console.log(`[Scheduler] Configuración guardada exitosamente`)
      return new Response(
        JSON.stringify({ success: true, message: 'Configuración guardada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============ ACTIVATE ============
    if (action === 'activate') {
      const { schedule } = body
      const cronSchedule = schedule || '0 * * * *'

      console.log(`[Scheduler] Activando job: ${jobName} con schedule: ${cronSchedule}`)

      // First try to remove existing job
      try {
        await supabase.rpc('cron_unschedule', { job_name: jobName })
        console.log(`[Scheduler] Job anterior eliminado`)
      } catch (e) {
        console.log(`[Scheduler] No existía job previo`)
      }

      // Create new cron job
      const functionUrl = `${supabaseUrl}/functions/v1/customer-crm-syncer`

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
        // Try alternative method using exec_sql
        const sqlCommand = `
          SELECT cron.schedule(
            '${jobName}',
            '${cronSchedule}',
            $$SELECT net.http_post(
              url := '${functionUrl}',
              headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
              body := '{"client_id": "${client_id}"}'::jsonb
            );$$
          );
        `
        const { error: altError } = await supabase.rpc('exec_sql', { sql_query: sqlCommand })
        if (altError) {
          console.error('[Scheduler] Alt method also failed:', altError)
          throw new Error(`Error creando cron: ${scheduleError.message}`)
        }
      }

      // Update status in DB
      await supabase.from('customer_integrations')
        .update({ is_active: true, cron_schedule: cronSchedule, updated_at: new Date().toISOString() })
        .eq('client_id', client_id)

      console.log(`[Scheduler] Job ${jobName} activado correctamente`)
      return new Response(
        JSON.stringify({ success: true, message: `Job ${jobName} activado`, schedule: cronSchedule }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============ DEACTIVATE ============
    if (action === 'deactivate') {
      console.log(`[Scheduler] Desactivando job: ${jobName}`)

      try {
        await supabase.rpc('cron_unschedule', { job_name: jobName })
      } catch (e) {
        console.log(`[Scheduler] Job no existía o ya fue eliminado`)
      }

      await supabase.from('customer_integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('client_id', client_id)

      console.log(`[Scheduler] Job ${jobName} desactivado correctamente`)
      return new Response(
        JSON.stringify({ success: true, message: `Job ${jobName} desactivado` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============ STATUS ============
    if (action === 'status') {
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

    throw new Error("Acción inválida. Usa: activate, deactivate, save_config, status")

  } catch (error: any) {
    console.error('[Scheduler] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
