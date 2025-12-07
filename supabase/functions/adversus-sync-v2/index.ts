import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuración de Supabase y API
const getServiceConfigs = () => {
  const sbUrl = Deno.env.get('SUPABASE_URL')!
  const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const advUser = Deno.env.get('ADVERSUS_API_USERNAME')
  const advPass = Deno.env.get('ADVERSUS_API_PASSWORD')
  
  if (!advUser || !advPass) throw new Error('Credenciales Adversus faltantes')
  
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
    const { supabase, authHeader, baseUrl } = getServiceConfigs()

    let result = {}

    // --- ROUTER DE ACCIONES ---
    switch (action) {
      case 'sync-campaigns':
        result = await syncCampaigns(supabase, baseUrl, authHeader)
        break
      case 'sync-users':
        result = await syncUsers(supabase, baseUrl, authHeader)
        break
      case 'sync-sales':
        result = await syncSales(supabase, baseUrl, authHeader, days)
        break
      default:
        throw new Error(`Acción desconocida: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error Crítico:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// --- FUNCIONES AUXILIARES ---

async function fetchAdversus(url: string, authHeader: string) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
  })
  if (res.status === 429) throw new Error('Rate Limit de Adversus excedido. Intenta más tarde.')
  if (!res.ok) throw new Error(`Error Adversus API: ${res.status} ${res.statusText}`)
  return await res.json()
}

// 1. SINCRONIZAR CAMPAÑAS
async function syncCampaigns(supabase: any, baseUrl: string, authHeader: string) {
  console.log('Iniciando sync de campañas...')
  const data = await fetchAdversus(`${baseUrl}/campaigns`, authHeader)
  const campaigns = data.campaigns || data || []
  let count = 0

  for (const camp of campaigns) {
    const name = camp.settings?.name || camp.name
    // Guardamos el mapeo si no existe
    const { error } = await supabase.from('adversus_campaign_mappings')
      .upsert({
        adversus_campaign_id: String(camp.id),
        adversus_campaign_name: name
      }, { onConflict: 'adversus_campaign_id', ignoreDuplicates: true }) // Solo insertar si es nuevo para no sobrescribir mapeos manuales
    
    if (!error) count++
  }
  return { success: true, message: `Campañas procesadas: ${count}` }
}

// 2. SINCRONIZAR USUARIOS (AGENTES)
async function syncUsers(supabase: any, baseUrl: string, authHeader: string) {
  console.log('Iniciando sync de usuarios...')
  const data = await fetchAdversus(`${baseUrl}/users`, authHeader)
  const users = data.users || data || []
  let count = 0

  for (const user of users) {
    // Ignorar admins/managers si es necesario, aquí importamos todo lo activo
    if (!user.active) continue;

    const { error } = await supabase.from('agents').upsert({
      external_adversus_id: String(user.id),
      name: user.name || user.displayName,
      email: user.email || `agent-${user.id}@placeholder.local`, // Fallback si no tiene email
      is_active: user.active
    }, { onConflict: 'external_adversus_id' })

    if (!error) count++
  }
  return { success: true, message: `Agentes actualizados: ${count}` }
}

// 3. SINCRONIZAR VENTAS (Lógica principal optimizada)
async function syncSales(supabase: any, baseUrl: string, authHeader: string, days: number) {
  console.log(`Iniciando sync de ventas (últimos ${days} días)...`)
  
  // Calcular fecha de inicio
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }))
  
  // Paginación
  let page = 1
  let allSales: any[] = []
  let hasMore = true

  while (hasMore && page <= 50) { // Límite de seguridad
    const url = `${baseUrl}/sales?pageSize=100&page=${page}&filters=${filterStr}`
    const data = await fetchAdversus(url, authHeader)
    const sales = data.sales || data || []
    
    if (sales.length === 0) {
      hasMore = false
    } else {
      allSales = [...allSales, ...sales]
      page++
    }
    // Pequeña pausa para no saturar
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`Total ventas encontradas: ${allSales.length}`)
  
  // Cargar caché de productos y mapeos para no consultar DB por cada venta
  const { data: products } = await supabase.from('products').select('id, name, commission_dkk, revenue_dkk')
  const { data: mappings } = await supabase.from('adversus_product_mappings').select('*')
  
  type ProductData = { id: string; name: string; commission_dkk: number | null; revenue_dkk: number | null }
  
  // Convertir a mapas para búsqueda O(1)
  const productMap = new Map<string, ProductData>((products || []).map((p: ProductData) => [p.name.toLowerCase(), p]))
  const mappingMap = new Map<string, string>((mappings || []).map((m: { adversus_external_id: string; product_id: string }) => [m.adversus_external_id, m.product_id]))

  let processed = 0
  let errors = 0

  for (const sale of allSales) {
    try {
      const externalId = String(sale.id)
      
      // Verificar si ya existe y si necesitamos actualizar (simple check por ID externo)
      const { data: existingSale } = await supabase
        .from('sales')
        .select('id')
        .eq('adversus_external_id', externalId)
        .maybeSingle()

      // Si existe, borramos los items antiguos para recrearlos (manejo simple de actualizaciones)
      if (existingSale) {
        await supabase.from('sale_items').delete().eq('sale_id', existingSale.id)
      }

      // 1. Insertar/Actualizar Venta
      const saleData = {
        adversus_external_id: externalId,
        sale_datetime: sale.closedTime || sale.createdTime,
        agent_external_id: String(sale.ownedBy || sale.createdBy),
        agent_name: sale.ownedBy?.name || 'Desconocido', // Adversus suele mandar ID, requiere macheo si no viene el nombre
        // NO buscamos OPP aquí para velocidad. Lo dejamos null o lo que ya tuviera.
        updated_at: new Date().toISOString()
      }
      
      // Si es nuevo insertamos, si existe actualizamos lo básico
      const { data: saleRecord, error: saleError } = await supabase
        .from('sales')
        .upsert(saleData, { onConflict: 'adversus_external_id' })
        .select('id')
        .single()

      if (saleError) throw saleError

      // 2. Procesar Líneas (Productos)
      const saleItems = []
      for (const line of (sale.lines || [])) {
        const extProdId = String(line.productId)
        const title = line.title
        const quantity = line.quantity || 1
        
        // Lógica de Macheo
        let productId: string | null = mappingMap.get(extProdId) ?? null // 1. Por ID mapeado
        
        if (!productId && title) {
           const p = productMap.get(title.toLowerCase())
           if (p) productId = p.id
        }

        // Datos financieros
        let commission = 0
        let revenue = 0
        
        if (productId) {
           // Si encontramos producto, buscamos sus datos financieros actuales
           // Nota: en un sistema real, productMap debería tener la data completa
           const prod = products?.find((p:any) => p.id === productId)
           if (prod) {
             commission = (prod.commission_dkk || 0) * quantity
             revenue = (prod.revenue_dkk || 0) * quantity
           }
        }

        saleItems.push({
          sale_id: saleRecord.id,
          product_id: productId || null,
          adversus_external_id: extProdId,
          adversus_product_title: title,
          quantity: quantity,
          unit_price: line.unitPrice || 0,
          mapped_commission: commission,
          mapped_revenue: revenue,
          needs_mapping: !productId, // Marcamos si falta mapeo
          raw_data: line
        })
      }

      if (saleItems.length > 0) {
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
        if (itemsError) throw itemsError
      }

      processed++

    } catch (err) {
      console.error(`Error procesando venta ${sale.id}:`, err)
      errors++
    }
  }

  return { 
    success: true, 
    message: `Sincronización completada. Procesados: ${processed}, Errores: ${errors}.`,
    details: { processed, errors }
  }
}
