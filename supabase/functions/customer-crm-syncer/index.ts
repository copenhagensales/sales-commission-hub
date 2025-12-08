import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HubSpotAdapter } from './adapters/hubspot.ts'
import { SalesforceAdapter } from './adapters/salesforce.ts'
import { GenericApiAdapter } from './adapters/generic.ts'
import { CrmAdapter, SaleToValidate } from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const startTime = Date.now();
  let clientId: string | null = null;

  try {
    const body = await req.json()
    clientId = body.client_id

    if (!clientId) throw new Error("client_id es requerido")

    console.log(`[CRM-Syncer] Iniciando sincronización para cliente: ${clientId}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const encryptionKey = Deno.env.get('DB_ENCRYPTION_KEY')!
    
    if (!encryptionKey) {
      throw new Error("DB_ENCRYPTION_KEY no configurada")
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Obtener configuración desencriptada
    const { data: integrations, error: integrationError } = await supabase
      .rpc('get_decrypted_integration', {
        p_client_id: clientId,
        p_encryption_key: encryptionKey
      })

    if (integrationError) {
      console.error('[CRM-Syncer] Error obteniendo integración:', integrationError)
      throw new Error(`Error de integración: ${integrationError.message}`)
    }

    if (!integrations || integrations.length === 0) {
      throw new Error("Integración no encontrada o no está activa")
    }

    const integration = integrations[0]
    console.log(`[CRM-Syncer] Integración encontrada: ${integration.crm_type}`)

    // 2. Obtener campañas del cliente
    const { data: campaigns } = await supabase
      .from('client_campaigns')
      .select('id')
      .eq('client_id', clientId)

    if (!campaigns || campaigns.length === 0) {
      console.log('[CRM-Syncer] No hay campañas para este cliente')
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No hay campañas configuradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const campaignIds = campaigns.map(c => c.id)

    // 3. Obtener ventas pendientes de validación
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, adversus_external_id, customer_phone, customer_company, agent_name, sale_datetime')
      .in('client_campaign_id', campaignIds)
      .or('status.is.null,status.eq.pending_validation')
      .limit(100) // Procesar en batches

    if (salesError) {
      console.error('[CRM-Syncer] Error obteniendo ventas:', salesError)
      throw new Error(`Error obteniendo ventas: ${salesError.message}`)
    }

    if (!sales || sales.length === 0) {
      console.log('[CRM-Syncer] No hay ventas pendientes de validación')
      
      await updateRunStatus(supabase, integration.id, 'success', 0)
      
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No hay ventas pendientes' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[CRM-Syncer] Encontradas ${sales.length} ventas para validar`)

    // 4. Seleccionar adaptador según tipo de CRM
    let adapter: CrmAdapter
    switch (integration.crm_type) {
      case 'hubspot':
        adapter = new HubSpotAdapter()
        break
      case 'salesforce':
        adapter = new SalesforceAdapter()
        break
      case 'generic_api':
        adapter = new GenericApiAdapter()
        break
      case 'pipedrive':
        // TODO: Implementar PipedriveAdapter
        throw new Error("Pipedrive adapter pendiente de implementación")
      case 'excel':
        // Excel no necesita validación externa
        throw new Error("Excel no requiere sincronización CRM")
      default:
        throw new Error(`CRM tipo '${integration.crm_type}' no soportado`)
    }

    // 5. Ejecutar validación
    const salesToValidate: SaleToValidate[] = sales.map(s => ({
      id: s.id,
      adversus_external_id: s.adversus_external_id,
      customer_phone: s.customer_phone,
      customer_company: s.customer_company,
      agent_name: s.agent_name,
      sale_datetime: s.sale_datetime
    }))

    const updates = await adapter.validateSales(
      salesToValidate,
      integration.credentials,
      integration.config || {}
    )

    // 6. Aplicar actualizaciones
    let updatedCount = 0
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          status: update.new_status,
          adversus_opp_number: update.opp_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id)

      if (updateError) {
        console.error(`[CRM-Syncer] Error actualizando venta ${update.id}:`, updateError)
      } else {
        updatedCount++
      }
    }

    // 7. Actualizar estado del run
    const duration = Date.now() - startTime
    await updateRunStatus(supabase, integration.id, 'success', updatedCount)

    console.log(`[CRM-Syncer] Completado: ${updatedCount}/${sales.length} ventas actualizadas en ${duration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: sales.length,
        updated: updatedCount,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[CRM-Syncer] Error:', error)

    // Intentar registrar el error en la integración
    if (clientId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        
        const { data: integration } = await supabase
          .from('customer_integrations')
          .select('id')
          .eq('client_id', clientId)
          .single()

        if (integration) {
          await updateRunStatus(supabase, integration.id, `error: ${error.message}`, 0)
        }
      } catch (e) {
        console.error('[CRM-Syncer] Error registrando fallo:', e)
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function updateRunStatus(supabase: any, integrationId: string, status: string, processedCount: number) {
  await supabase
    .from('customer_integrations')
    .update({
      last_run_at: new Date().toISOString(),
      last_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', integrationId)
}
