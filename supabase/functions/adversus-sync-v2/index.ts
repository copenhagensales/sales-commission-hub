import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- SISTEMA DE LOGGING ROBUSTO ---
function log(type: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type,
    message,
    data: data ? (typeof data === 'object' ? data : { value: data }) : null
  }))
}

// Configuración de servicios
const getConfigs = () => {
  const sbUrl = Deno.env.get('SUPABASE_URL')!
  const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const advUser = Deno.env.get('ADVERSUS_API_USERNAME')
  const advPass = Deno.env.get('ADVERSUS_API_PASSWORD')
  
  if (!advUser || !advPass) throw new Error('Faltan credenciales de Adversus')
  
  return {
    supabase: createClient(sbUrl, sbKey),
    authHeader: btoa(`${advUser}:${advPass}`),
    baseUrl: 'https://api.adversus.io/v1'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { action, days = 1 } = await req.json()
    const config = getConfigs()
    
    log('INFO', `Iniciando ejecución: ${action}`, { days })

    let result = {}

    switch (action) {
      case 'test-connection':
        result = await testConnection(config)
        break
      case 'sync-campaigns':
        result = await syncCampaigns(config)
        break
      case 'sync-users':
        result = await syncUsers(config)
        break
      case 'sync-sales':
        result = await syncSales(config, days)
        break
      default:
        throw new Error(`Acción no reconocida: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    log('ERROR', 'Fallo crítico en la función', { error: error.message, stack: error.stack })
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// --- FUNCIONES AUXILIARES DE API ---

async function fetchAdversus(url: string, authHeader: string) {
  const start = Date.now()
  const res = await fetch(url, {
    headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
  })
  
  const duration = Date.now() - start
  
  if (res.status === 429) {
    log('WARN', 'Rate Limit alcanzado en Adversus', { url })
    throw new Error('Rate Limit Adversus')
  }
  
  if (!res.ok) {
    const text = await res.text()
    log('ERROR', 'Error API Adversus', { status: res.status, url, response: text })
    throw new Error(`API Error: ${res.status}`)
  }

  log('INFO', 'Fetch exitoso', { url, duration_ms: duration })
  return await res.json()
}

// 1. TEST DE CONEXIÓN (Para debug rápido)
async function testConnection({ baseUrl, authHeader }: any) {
  try {
    const data = await fetchAdversus(`${baseUrl}/campaigns?pageSize=1`, authHeader)
    return { success: true, message: 'Conexión exitosa', data }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

// 2. SINCRONIZAR CAMPAÑAS
async function syncCampaigns({ supabase, baseUrl, authHeader }: any) {
  const data = await fetchAdversus(`${baseUrl}/campaigns`, authHeader)
  const campaigns = data.campaigns || data || []
  
  let upserted = 0
  let errors = 0

  for (const camp of campaigns) {
    const name = camp.settings?.name || camp.name
    // Insertamos solo el mapeo base para tener el nombre
    const { error } = await supabase.from('adversus_campaign_mappings')
      .upsert({
        adversus_campaign_id: String(camp.id),
        adversus_campaign_name: name
      }, { onConflict: 'adversus_campaign_id', ignoreDuplicates: true }) // No sobrescribir si ya existe
    
    if (error) {
      log('ERROR', 'Error guardando campaña', { id: camp.id, error })
      errors++
    } else {
      upserted++
    }
  }
  
  return { success: true, upserted, errors }
}

// 2. SINCRONIZAR USUARIOS (AGENTES) - Versión Segura (Sin Upsert)
async function syncUsers({ supabase, baseUrl, authHeader }: any) {
  log('INFO', 'Iniciando sync de usuarios...')
  const data = await fetchAdversus(`${baseUrl}/users`, authHeader)
  const users = data.users || data || []
  
  let processed = 0
  let errors = 0
  
  for (const user of users) {
    if (!user.active) continue

    const externalId = String(user.id)
    const agentData = {
      external_adversus_id: externalId,
      name: user.name || user.displayName,
      email: user.email || `agent-${user.id}@adversus.local`,
      is_active: true
    }

    try {
      // Paso 1: Buscar si existe
      const { data: existing } = await supabase
        .from('agents')
        .select('id')
        .eq('external_adversus_id', externalId)
        .maybeSingle()

      if (existing) {
        // Paso 2A: Actualizar
        const { error } = await supabase
          .from('agents')
          .update(agentData)
          .eq('id', existing.id)
        if (error) throw error
      } else {
        // Paso 2B: Insertar
        const { error } = await supabase
          .from('agents')
          .insert(agentData)
        if (error) throw error
      }
      processed++
    } catch (err: any) {
      log('ERROR', 'Error procesando agente', { id: user.id, error: err.message })
      errors++
    }
  }

  return { success: true, processed, errors }
}

// 4. SINCRONIZAR VENTAS - Versión Segura (Sin Upsert)
async function syncSales({ supabase, baseUrl, authHeader }: any, days: number) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }))
  
  let page = 1
  let allSales: any[] = []
  let hasMore = true
  
  log('INFO', 'Iniciando descarga de ventas', { since: startDate.toISOString() })

  // 4.1 Descargar todas las ventas
  while (hasMore && page <= 50) {
    const url = `${baseUrl}/sales?pageSize=100&page=${page}&filters=${filterStr}`
    const data = await fetchAdversus(url, authHeader)
    const salesPage = data.sales || data || []
    
    if (salesPage.length === 0) hasMore = false
    else {
      allSales = [...allSales, ...salesPage]
      page++
    }
    await new Promise(r => setTimeout(r, 100))
  }

  log('INFO', `Ventas descargadas: ${allSales.length}`)

  // 4.2 Cargar datos de referencia
  const { data: products } = await supabase.from('products').select('id, name, commission_dkk, revenue_dkk')
  const { data: prodMappings } = await supabase.from('adversus_product_mappings').select('*')
  
  const mapByExtId = new Map(prodMappings?.map((m: any) => [m.adversus_external_id, m.product_id]))
  const mapByName = new Map(products?.map((p: any) => [p.name.toLowerCase(), p]))

  let processed = 0
  let errors = 0

  // 4.3 Procesar cada venta MANUALMENTE (Sin Upsert)
  for (const sale of allSales) {
    try {
      const externalId = String(sale.id)
      
      const saleData = {
        adversus_external_id: externalId,
        sale_datetime: sale.closedTime || sale.createdTime,
        agent_external_id: String(sale.ownedBy || sale.createdBy),
        agent_name: sale.ownedBy?.name || 'Desconocido', 
        updated_at: new Date().toISOString()
      }

      // --- CAMBIO CLAVE: MANUAL CHECK ---
      let saleId = null
      
      const { data: existingSale, error: findError } = await supabase
        .from('sales')
        .select('id')
        .eq('adversus_external_id', externalId)
        .maybeSingle()

      if (findError) throw findError

      if (existingSale) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('sales')
          .update(saleData)
          .eq('id', existingSale.id)
        
        if (updateError) throw updateError
        saleId = existingSale.id
        
        // Limpiar items viejos para regenerarlos
        await supabase.from('sale_items').delete().eq('sale_id', saleId)
      } else {
        // INSERT
        const { data: newSale, error: insertError } = await supabase
          .from('sales')
          .insert(saleData)
          .select('id')
          .single()
        
        if (insertError) throw insertError
        saleId = newSale.id
      }
      // ----------------------------------

      const itemsToInsert = []

      for (const line of (sale.lines || [])) {
        const extProdId = String(line.productId)
        const title = line.title || 'Producto desconocido'
        const quantity = line.quantity || 1
        
        let productId = mapByExtId.get(extProdId)
        let commission = 0
        let revenue = 0
        
        if (!productId && title) {
           const p = mapByName.get(title.toLowerCase()) as any
           if (p) productId = p.id
        }

        if (productId) {
           const prod = products?.find((p:any) => p.id === productId)
           if (prod) {
             commission = (prod.commission_dkk || 0) * quantity
             revenue = (prod.revenue_dkk || 0) * quantity
           }
        }

        itemsToInsert.push({
          sale_id: saleId,
          product_id: productId || null,
          adversus_external_id: extProdId,
          adversus_product_title: title,
          quantity: quantity,
          unit_price: line.unitPrice || 0,
          mapped_commission: commission,
          mapped_revenue: revenue,
          needs_mapping: !productId,
          raw_data: line
        })
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert)
        if (itemsError) throw itemsError
      }

      processed++

    } catch (err: any) {
      errors++
      log('ERROR', `Fallo en venta ID ${sale.id}`, { msg: err.message, code: err.code })
    }
  }

  log('INFO', 'Proceso finalizado', { processed, errors })

  return { 
    success: true, 
    processed, 
    errors,
    message: `Sincronización completada: ${processed} ventas procesadas, ${errors} errores.` 
  }
}
