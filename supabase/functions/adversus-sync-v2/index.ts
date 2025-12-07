import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- SISTEMA DE LOGGING ---
function log(type: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type,
    message,
    data: data ? (typeof data === 'object' ? data : { value: data }) : null
  }))
}

// Configuración
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
      case 'sync-campaigns':
        result = await syncCampaignsSafe(config)
        break
      case 'sync-users':
        result = await syncUsersSafe(config)
        break
      case 'sync-sales':
        result = await syncSalesSafe(config, days)
        break
      default:
        throw new Error(`Acción desconocida: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    log('ERROR', 'Fallo crítico', { error: error.message })
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function fetchAdversus(url: string, authHeader: string) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
  })
  if (res.status === 429) throw new Error('Rate Limit Adversus')
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return await res.json()
}

// 1. CAMPAÑAS - MODO SEGURO (Sin Upsert)
async function syncCampaignsSafe({ supabase, baseUrl, authHeader }: any) {
  const data = await fetchAdversus(`${baseUrl}/campaigns`, authHeader)
  const campaigns = data.campaigns || data || []
  let count = 0
  let errors = 0

  for (const camp of campaigns) {
    const name = camp.settings?.name || camp.name
    const campaignId = String(camp.id)

    try {
      // Manual Check
      const { data: existing } = await supabase
        .from('adversus_campaign_mappings')
        .select('id')
        .eq('adversus_campaign_id', campaignId)
        .maybeSingle()

      if (existing) {
        // Update (si cambiara el nombre, por ejemplo)
        await supabase
          .from('adversus_campaign_mappings')
          .update({ adversus_campaign_name: name })
          .eq('id', existing.id)
      } else {
        // Insert
        await supabase
          .from('adversus_campaign_mappings')
          .insert({
            adversus_campaign_id: campaignId,
            adversus_campaign_name: name
          })
      }
      count++
    } catch (e: any) {
      log('ERROR', 'Error campaña', { id: campaignId, msg: e.message })
      errors++
    }
  }
  return { success: true, processed: count, errors }
}

// 2. USUARIOS - MODO SEGURO (Sin Upsert)
async function syncUsersSafe({ supabase, baseUrl, authHeader }: any) {
  const data = await fetchAdversus(`${baseUrl}/users`, authHeader)
  const users = data.users || data || []
  let count = 0
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
      // Manual Check
      const { data: existing } = await supabase
        .from('agents')
        .select('id')
        .eq('external_adversus_id', externalId)
        .maybeSingle()

      if (existing) {
        await supabase.from('agents').update(agentData).eq('id', existing.id)
      } else {
        await supabase.from('agents').insert(agentData)
      }
      count++
    } catch (e: any) {
      log('ERROR', 'Error agente', { id: externalId, msg: e.message })
      errors++
    }
  }
  return { success: true, processed: count, errors }
}

// 3. VENTAS - MODO SEGURO (Optimizada para Datos)
async function syncSalesSafe({ supabase, baseUrl, authHeader }: any, days: number) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }))
  
  let page = 1
  let allSales: any[] = []
  let hasMore = true
  
  log('INFO', 'Descargando ventas', { since: startDate.toISOString() })

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

  log('INFO', `Total ventas a procesar: ${allSales.length}`)

  // --- CACHES (Aquí está la magia para recuperar nombres) ---
  
  // 1. Productos y Mapeos
  const { data: products } = await supabase.from('products').select('id, name, commission_dkk, revenue_dkk')
  const { data: prodMappings } = await supabase.from('adversus_product_mappings').select('*')
  
  // 2. Agentes (Para quitar el "Desconocido")
  const { data: agents } = await supabase.from('agents').select('id, external_adversus_id, name')

  // Mapas para búsqueda rápida
  const mapByExtId = new Map(prodMappings?.map((m: any) => [m.adversus_external_id, m.product_id]))
  const mapByName = new Map(products?.map((p: any) => [p.name.toLowerCase(), p]))
  const mapAgents = new Map(agents?.map((a: any) => [String(a.external_adversus_id), a])) // Mapa de agentes por ID externo

  let processed = 0
  let errors = 0

  for (const sale of allSales) {
    try {
      const externalId = String(sale.id)
      
      // Resolver Agente
      // Adversus a veces manda el objeto completo o solo el ID en ownedBy/createdBy
      const agentExtId = String(sale.ownedBy?.id || sale.ownedBy || sale.createdBy?.id || sale.createdBy)
      const internalAgent = mapAgents.get(agentExtId)
      
      // Si tenemos el agente en BD usamos su nombre, si no, intentamos leerlo del objeto sale, si no "Desconocido"
      const agentName = (internalAgent as any)?.name || sale.ownedBy?.name || sale.createdBy?.name || 'Desconocido'

      // Resolver Cliente (Intentar leer del objeto lead embebido si existe)
      const customerCompany = sale.lead?.company || sale.lead?.name || ''
      const customerPhone = sale.lead?.phone || ''

      const saleData = {
        adversus_external_id: externalId,
        sale_datetime: sale.closedTime || sale.createdTime,
        agent_external_id: agentExtId,
        agent_name: agentName,
        customer_company: customerCompany,
        customer_phone: customerPhone,
        updated_at: new Date().toISOString()
      }

      // Manual Check Venta
      let saleId = null
      const { data: existingSale } = await supabase
        .from('sales')
        .select('id')
        .eq('adversus_external_id', externalId)
        .maybeSingle()

      if (existingSale) {
        await supabase.from('sales').update(saleData).eq('id', existingSale.id)
        saleId = existingSale.id
        await supabase.from('sale_items').delete().eq('sale_id', saleId)
      } else {
        const { data: newSale } = await supabase
          .from('sales')
          .insert(saleData)
          .select('id')
          .single()
        saleId = newSale.id
      }

      // Procesar Items
      const itemsToInsert = []
      for (const line of (sale.lines || [])) {
        const extProdId = String(line.productId)
        const title = line.title || 'Producto desconocido'
        const quantity = line.quantity || 1
        
        let productId = mapByExtId.get(extProdId)
        let commission = 0
        let revenue = 0
        
        if (!productId && title) {
           const p = mapByName.get(title.toLowerCase())
           if (p) productId = (p as any).id
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
        await supabase.from('sale_items').insert(itemsToInsert)
      }

      processed++

    } catch (err: any) {
      errors++
      log('ERROR', `Fallo venta ${sale.id}`, { msg: err.message })
    }
  }

  log('INFO', 'Proceso finalizado', { processed, errors })
  return { success: true, processed, errors }
}
