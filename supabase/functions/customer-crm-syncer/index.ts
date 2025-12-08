import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HubSpotAdapter } from './adapters/hubspot.ts'
import { SalesforceAdapter } from './adapters/salesforce.ts'
import { GenericApiAdapter } from './adapters/generic.ts'
import { CrmAdapter } from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { client_id } = await req.json()
    
    if (!client_id) throw new Error("client_id es requerido")

    console.log(`[CRM-Syncer] Iniciando sincronización para cliente: ${client_id}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const encryptionKey = Deno.env.get('DB_ENCRYPTION_KEY')!
    
    if (!encryptionKey) throw new Error("Falta DB_ENCRYPTION_KEY")

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Obtener configuración desencriptada
    const { data: integrations, error: integrationError } = await supabase
      .rpc('get_decrypted_integration', { 
        p_client_id: client_id, 
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
      .eq('client_id', client_id)

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
      .limit(100)

    if (salesError) {
      console.error('[CRM-Syncer] Error obteniendo ventas:', salesError)
      throw new Error(`Error obteniendo ventas: ${salesError.message}`)
    }

    // 4. Preparar Configuración Combinada con api_url
    const fullConfig = {
      ...integration.config,
      base_url: integration.api_url
    }

    // 5. Seleccionar Adaptador
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
        throw new Error("Pipedrive adapter pendiente de implementación")
      case 'excel':
        throw new Error("Excel no requiere sincronización CRM")
      default:
        throw new Error(`CRM tipo '${integration.crm_type}' no soportado`)
    }

    // 6. Ejecutar validación
    let updates: any[] = []
    
    if (!sales || sales.length === 0) {
      console.log('[CRM-Syncer] No hay ventas pendientes de validación')
      
      // Probar conexión si el adaptador lo soporta
      if ('testConnection' in adapter && typeof (adapter as any).testConnection === 'function') {
        console.log('[CRM-Syncer] Probando conexión al CRM...')
        await (adapter as any).testConnection(integration.credentials, fullConfig)
        console.log('[CRM-Syncer] Conexión exitosa')
      }
    } else {
      console.log(`[CRM-Syncer] Encontradas ${sales.length} ventas para validar`)
      
      const salesToValidate = sales.map(s => ({
        id: s.id,
        adversus_external_id: s.adversus_external_id,
        customer_phone: s.customer_phone,
        customer_company: s.customer_company,
        agent_name: s.agent_name,
        sale_datetime: s.sale_datetime
      }))

      updates = await adapter.validateSales(
        salesToValidate,
        integration.credentials,
        fullConfig
      )
    }

    // 7. Aplicar actualizaciones
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

    // 8. Actualizar estado del run
    await supabase
      .from('customer_integrations')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'success',
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)

    console.log(`[CRM-Syncer] Completado: ${updatedCount}/${sales?.length || 0} ventas actualizadas`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: sales?.length || 0,
        updated: updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[CRM-Syncer] Error:', error)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
