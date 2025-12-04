import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdversusSession {
  id: number
  leadId: number
  userId: number
  campaignId: number
  startTime: string
  endTime: string
  status: string
  sessionSeconds: number
  cdr?: {
    destination: string
    startTime: string
    answerTime: string
    endTime: string
    durationSeconds: number
    disposition: string
  }
}

interface AdversusUser {
  id: number
  name: string
  displayName: string
  email: string
  active: boolean
  role?: string
  accessLevel?: string
  isAgent?: boolean
  isManager?: boolean
}

interface ResultField {
  id: number
  type: string
  name?: string
  active: boolean
  options?: Array<{ id: number; value: string }>
}

interface AdversusCampaign {
  id: number
  name?: string
  settings?: {
    name?: string
    active?: boolean
  }
  resultFields?: ResultField[]
}

interface AdversusLead {
  id: number
  campaignId: number
  status: string
  // Outcome/result fields - could contain product selection
  result?: string
  outcome?: string
  closingCode?: string
  product?: string
  selectedProduct?: string
  resultData?: Array<{ id: number; value: string; label?: string }>
  // Contact data fields
  phoneNumbers?: string[]
  phone?: string
  mobile?: string
  contactData?: {
    phone?: string
    mobile?: string
    phoneNumbers?: string[]
    [key: string]: unknown
  }
}

interface Product {
  id: string
  code: string
  name: string
  commission_type: string
  commission_value: number
}

interface CampaignMapping {
  id: string
  adversus_campaign_id: string
  adversus_campaign_name: string
  adversus_outcome: string | null
  product_id: string | null
}

// Campaign name to product code prefix mapping (fallback for auto-matching)
const CAMPAIGN_TO_PRODUCT_PREFIX: Record<string, string> = {
  'aka': 'AKA',
  'ase': 'ASE',
  'business danmark': 'BD',
  'codan': 'CODAN',
  'eesy & hiper fm': 'EESY-FM',
  'eesy hiper': 'EESY-FM',
  'eesy tm': 'EESY-TM',
  'eesy marked': 'EESY-MM',
  'eesy messer': 'EESY-MM',
  'finansforbundet': 'FF',
  'min a-kasse': 'MAK',
  'relatel': 'REL',
  'tdc erhverv': 'TDCE',
  'tdc ren provi': 'TDC',
  'tryg': 'TRYG',
  'yousee': 'YS',
}

function findMatchingProduct(
  campaignName: string | undefined | null,
  outcomeName: string | undefined,
  products: Product[]
): Product | null {
  if (!campaignName) {
    console.log('No campaign name provided for matching')
    return null
  }
  const campaignLower = campaignName.toLowerCase()
  const outcomeLower = outcomeName?.toLowerCase() || ''
  
  // Find the product prefix based on campaign name
  let productPrefix: string | null = null
  for (const [keyword, prefix] of Object.entries(CAMPAIGN_TO_PRODUCT_PREFIX)) {
    if (campaignLower.includes(keyword)) {
      productPrefix = prefix
      break
    }
  }
  
  if (!productPrefix) {
    console.log(`No product prefix found for campaign: ${campaignName}`)
    return null
  }
  
  // Filter products by prefix
  const matchingProducts = products.filter(p => p.code.startsWith(productPrefix!))
  
  if (matchingProducts.length === 0) {
    console.log(`No products found with prefix: ${productPrefix}`)
    return null
  }
  
  // If only one product matches the prefix, use it
  if (matchingProducts.length === 1) {
    return matchingProducts[0]
  }
  
  // Try to find a more specific match based on outcome/product name
  if (outcomeLower) {
    const outcomeWords = outcomeLower
      .replace(/[^a-zæøå0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
    
    let bestMatch: Product | null = null
    let bestScore = 0
    
    for (const product of matchingProducts) {
      const productNameLower = product.name.toLowerCase()
      let score = 0
      
      for (const word of outcomeWords) {
        if (productNameLower.includes(word)) {
          score += word.length
        }
      }
      
      // Check for specific keywords
      if (outcomeLower.includes('stud') && productNameLower.includes('stud')) score += 10
      if (outcomeLower.includes('erhverv') && productNameLower.includes('erhverv')) score += 10
      if (outcomeLower.includes('nuuday') && productNameLower.includes('nuuday')) score += 10
      if (outcomeLower.includes('straks') && productNameLower.includes('straks')) score += 10
      if (outcomeLower.includes('lead') && productNameLower.includes('lead')) score += 10
      if (outcomeLower.includes('winback') && productNameLower.includes('winback')) score += 10
      if (outcomeLower.includes('booket') && productNameLower.includes('booket')) score += 10
      if (outcomeLower.includes('mbb') && productNameLower.includes('mbb')) score += 10
      if (outcomeLower.includes('fiber') && productNameLower.includes('fiber')) score += 10
      if (outcomeLower.includes('5g') && productNameLower.includes('5g')) score += 10
      if (outcomeLower.includes('omstilling') && productNameLower.includes('omstilling')) score += 10
      if (outcomeLower.includes('fysisk') && productNameLower.includes('fysisk')) score += 10
      if (outcomeLower.includes('online') && productNameLower.includes('online')) score += 10
      if (outcomeLower.includes('telefon') && productNameLower.includes('telefon')) score += 10
      
      // Check for percentage tilskud matching
      const tilskudMatch = outcomeLower.match(/(\d+)%\s*tilskud/)
      if (tilskudMatch && productNameLower.includes(`${tilskudMatch[1]}% tilskud`)) {
        score += 15
      }
      
      // Check for GB matching
      const gbMatch = outcomeLower.match(/(\d+)\s*gb/i)
      if (gbMatch && productNameLower.includes(`${gbMatch[1]}gb`)) {
        score += 15
      }
      
      if (score > bestScore) {
        bestScore = score
        bestMatch = product
      }
    }
    
    if (bestMatch && bestScore > 5) {
      console.log(`Matched outcome "${outcomeName}" to product "${bestMatch.name}" (score: ${bestScore})`)
      return bestMatch
    }
  }
  
  // Return the first matching product as fallback
  console.log(`Using first product with prefix ${productPrefix}: ${matchingProducts[0].name}`)
  return matchingProducts[0]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adversusUsername = Deno.env.get('ADVERSUS_API_USERNAME')
    const adversusPassword = Deno.env.get('ADVERSUS_API_PASSWORD')

    if (!adversusUsername || !adversusPassword) {
      console.error('Missing Adversus API credentials')
      return new Response(
        JSON.stringify({ error: 'Adversus API credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const authHeader = btoa(`${adversusUsername}:${adversusPassword}`)
    const baseUrl = 'https://api.adversus.io/v1'

    console.log('Starting Adversus sync...')

    // Parse request body for date range or debug action
    let startDate: string | null = null
    let endDate: string | null = null
    let debugAction: string | null = null
    let debugCampaignId: number | null = null
    let scanDays: number = 60 // Default scan period
    let requestBody: any = null
    
    try {
      requestBody = await req.json()
      startDate = requestBody.startDate
      endDate = requestBody.endDate
      debugAction = requestBody.action
      debugCampaignId = requestBody.campaignId
      scanDays = requestBody.scanDays || 60
    } catch {
      // Use default date range (last 30 days)
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = thirtyDaysAgo.toISOString()
      endDate = now.toISOString()
    }

    // Debug action: fetch Adversus products
    if (debugAction === 'fetch-products') {
      let searchFilter = ''
      const body = requestBody || {}
      if (body.filter) {
        searchFilter = `&filters=${encodeURIComponent(JSON.stringify({ title: { $c: body.filter } }))}`
      }
      
      console.log(`Debug: Fetching Adversus products... filter: ${searchFilter}`)
      
      // Fetch multiple pages to get all products
      let allProducts: unknown[] = []
      let page = 1
      const pageSize = 100
      
      while (page <= 10) { // Max 10 pages = 1000 products
        const url = `${baseUrl}/products?pageSize=${pageSize}&page=${page}${searchFilter}`
        console.log(`Fetching page ${page}: ${url}`)
        
        const productsResponse = await fetch(url, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          const products = Array.isArray(productsData) ? productsData : (productsData.products || [])
          
          if (products.length === 0) break
          
          allProducts = [...allProducts, ...products]
          console.log(`Page ${page}: Got ${products.length} products, total: ${allProducts.length}`)
          
          if (products.length < pageSize) break // Last page
          page++
        } else {
          console.error(`Failed to fetch page ${page}:`, await productsResponse.text())
          break
        }
      }
      
      console.log(`Total Adversus products fetched: ${allProducts.length}`)
      return new Response(
        JSON.stringify({ products: allProducts, total: allProducts.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Debug action: fetch all campaigns and filter by name
    if (debugAction === 'fetch-campaigns') {
      let filterName = ''
      const body = requestBody || {}
      filterName = body.filter || ''
      
      console.log(`Debug: Fetching Adversus campaigns... filter: ${filterName}`)
      
      const campaignsResponse = await fetch(`${baseUrl}/campaigns`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json()
        const allCampaigns = campaignsData.campaigns || campaignsData || []
        
        // Filter campaigns by name if filter provided
        let filteredCampaigns = allCampaigns
        if (filterName) {
          const filterLower = filterName.toLowerCase()
          filteredCampaigns = allCampaigns.filter((c: any) => {
            const name = c.settings?.name || c.name || ''
            return name.toLowerCase().includes(filterLower)
          })
        }
        
        // Map to cleaner format with resultFields
        const campaigns = filteredCampaigns.map((c: any) => ({
          id: c.id,
          name: c.settings?.name || c.name,
          active: c.settings?.active,
          resultFields: c.resultFields || []
        }))
        
        console.log(`Found ${campaigns.length} campaigns matching "${filterName}"`)
        return new Response(
          JSON.stringify({ campaigns, total: campaigns.length }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch campaigns', status: campaignsResponse.status }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Debug action: fetch sales for a campaign
    if (debugAction === 'fetch-sales') {
      let filterCampaignId: number | null = null
      let filterDays = 7 // default 7 days
      const body = requestBody || {}
      filterCampaignId = body.campaignId ?? null
      filterDays = body.days || 7
      
      // Build filter for date range
      const now = new Date()
      const startDate = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000)
      
      // Build filters object
      const filters: Record<string, unknown> = {
        created: { $gt: startDate.toISOString() }
      }
      if (filterCampaignId) {
        filters.campaign = { $eq: filterCampaignId }
      }
      
      const filterStr = encodeURIComponent(JSON.stringify(filters))
      const url = `${baseUrl}/sales?pageSize=100&filters=${filterStr}`
      
      console.log(`Debug: Fetching Adversus sales... URL: ${url}`)
      
      const salesResponse = await fetch(url, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })
      
      const responseText = await salesResponse.text()
      console.log(`Sales response status: ${salesResponse.status}, body length: ${responseText.length}`)
      
      if (salesResponse.ok) {
        const salesData = JSON.parse(responseText)
        const sales = Array.isArray(salesData) ? salesData : (salesData.sales || salesData || [])
        
        // Extract unique product titles from sales lines
        const productTitles = new Map<string, number>()
        for (const sale of sales) {
          if (sale.lines) {
            for (const line of sale.lines) {
              const title = line.title || 'Unknown'
              productTitles.set(title, (productTitles.get(title) || 0) + 1)
            }
          }
        }
        
        return new Response(
          JSON.stringify({ 
            sales, 
            total: sales.length,
            productSummary: Object.fromEntries(productTitles),
            filters: { campaignId: filterCampaignId, days: filterDays }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch sales', status: salesResponse.status, body: responseText }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ACTION: Sync sales to database
    if (debugAction === 'sync-sales-to-db') {
      let filterDays = 30
      const body = requestBody || {}
      filterDays = body.days || 30
      
      console.log(`Syncing sales to database (last ${filterDays} days)...`)
      
      // Fetch campaigns first for lookup
      const campaignsResponse = await fetch(`${baseUrl}/campaigns?pageSize=200`, {
        headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
      })
      const campaignsData = await campaignsResponse.json()
      const campaigns = Array.isArray(campaignsData) ? campaignsData : (campaignsData.campaigns || [])
      const campaignLookup: Record<number, string> = {}
      for (const c of campaigns) {
        campaignLookup[c.id] = c.settings?.name || c.name || `Campaign ${c.id}`
      }

      // Fetch users for agent lookup
      const usersResponse = await fetch(`${baseUrl}/users?pageSize=200`, {
        headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
      })
      const usersData = await usersResponse.json()
      const users = Array.isArray(usersData) ? usersData : (usersData.users || [])
      const userLookup: Record<number, { name: string; email: string }> = {}
      for (const u of users) {
        userLookup[u.id] = { name: u.displayName || u.name || `User ${u.id}`, email: u.email || '' }
      }

      // Fetch sales
      const now = new Date()
      const startDateSync = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000)
      const filtersSync = { created: { $gt: startDateSync.toISOString() } }
      const filterStrSync = encodeURIComponent(JSON.stringify(filtersSync))
      
      let allSalesSync: any[] = []
      let pageSync = 1
      while (pageSync <= 20) {
        const salesResponseSync = await fetch(`${baseUrl}/sales?pageSize=100&page=${pageSync}&filters=${filterStrSync}`, {
          headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
        })
        if (!salesResponseSync.ok) break
        const salesDataSync = await salesResponseSync.json()
        const salesSync = Array.isArray(salesDataSync) ? salesDataSync : (salesDataSync.sales || [])
        if (salesSync.length === 0) break
        allSalesSync = [...allSalesSync, ...salesSync]
        if (salesSync.length < 100) break
        pageSync++
        await new Promise(r => setTimeout(r, 300))
      }

      console.log(`Fetched ${allSalesSync.length} sales from Adversus`)

      // Get existing external_ids to avoid duplicates
      const { data: existingEvents } = await supabase
        .from('adversus_events')
        .select('external_id')
      const existingIds = new Set((existingEvents || []).map(e => e.external_id))

      // Get products for matching
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, commission_dkk, revenue_dkk')
      const productsByName: Record<string, { id: string; commission_dkk: number; revenue_dkk: number }> = {}
      for (const p of productsData || []) {
        productsByName[p.name.toLowerCase()] = p
      }

      let created = 0, skipped = 0, errors = 0

      for (const sale of allSalesSync) {
        const externalId = String(sale.id)
        
        if (existingIds.has(externalId)) {
          skipped++
          continue
        }

        try {
          const campaignName = campaignLookup[sale.campaignId] || `Campaign ${sale.campaignId}`
          const user = userLookup[sale.ownedBy] || userLookup[sale.createdBy] || { name: 'Unknown', email: '' }
          
          const payload = {
            type: 'sale',
            event_time: sale.closedTime || sale.createdTime,
            payload: {
              result_id: sale.id,
              campaign: { id: String(sale.campaignId), name: campaignName },
              user: { id: String(sale.ownedBy || sale.createdBy), name: user.name, email: user.email },
              lead: { id: sale.leadId, phone: '', company: '' },
              products: (sale.lines || []).map((line: { productId: number; title: string; quantity: number; unitPrice: number }) => ({
                id: line.productId,
                externalId: String(line.productId),
                title: line.title,
                quantity: line.quantity || 1,
                unitPrice: line.unitPrice || 0
              }))
            }
          }

          const { data: eventData, error: eventError } = await supabase
            .from('adversus_events')
            .insert({
              external_id: externalId,
              event_type: 'sale',
              payload,
              processed: false,
              received_at: new Date().toISOString()
            })
            .select()
            .single()

          if (eventError) throw eventError

          const { data: campaignMapping } = await supabase
            .from('adversus_campaign_mappings')
            .select('client_campaign_id')
            .eq('adversus_campaign_id', String(sale.campaignId))
            .maybeSingle()

          if (!campaignMapping) {
            await supabase
              .from('adversus_campaign_mappings')
              .upsert({
                adversus_campaign_id: String(sale.campaignId),
                adversus_campaign_name: campaignName,
                client_campaign_id: null
              }, { onConflict: 'adversus_campaign_id' })
          }

          const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert({
              adversus_event_id: eventData.id,
              client_campaign_id: campaignMapping?.client_campaign_id || null,
              agent_name: user.name,
              agent_external_id: String(sale.ownedBy || sale.createdBy),
              customer_company: '',
              customer_phone: '',
              sale_datetime: sale.closedTime || sale.createdTime || new Date().toISOString(),
              adversus_external_id: externalId,
            })
            .select()
            .single()

          if (saleError) throw saleError

          const saleItems = []
          for (const line of sale.lines || []) {
            const matchedProduct = productsByName[line.title?.toLowerCase()]
            const commission = matchedProduct?.commission_dkk || 0
            const revenue = matchedProduct?.revenue_dkk || 0
            const quantity = line.quantity || 1

            saleItems.push({
              sale_id: saleData.id,
              product_id: matchedProduct?.id || null,
              adversus_external_id: String(line.productId),
              adversus_product_title: line.title,
              quantity,
              unit_price: line.unitPrice || 0,
              mapped_commission: commission * quantity,
              mapped_revenue: revenue * quantity,
              needs_mapping: !matchedProduct,
              raw_data: line
            })
          }

          if (saleItems.length > 0) {
            await supabase.from('sale_items').insert(saleItems)
          }

          await supabase
            .from('adversus_events')
            .update({ processed: true })
            .eq('id', eventData.id)

          created++
          existingIds.add(externalId)
        } catch (err) {
          console.error(`Error syncing sale ${externalId}:`, err)
          errors++
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          fetched: allSalesSync.length,
          created,
          skipped,
          errors,
          message: `Synced ${created} new sales, skipped ${skipped} existing, ${errors} errors`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Debug action: scan all campaigns for products AND outcomes - creates mappings automatically
    if (debugAction === 'scan-all-products') {
      console.log(`Debug: Scanning all campaigns for products and outcomes (last ${scanDays} days)...`)
      
      // First fetch all campaigns
      const campaignsResponse = await fetch(`${baseUrl}/campaigns?pageSize=200`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!campaignsResponse.ok) {
        const errorBody = await campaignsResponse.text()
        console.error(`Failed to fetch campaigns: ${campaignsResponse.status} - ${errorBody}`)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch campaigns', status: campaignsResponse.status, details: errorBody }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const campaignsData = await campaignsResponse.json()
      const campaigns = Array.isArray(campaignsData) ? campaignsData : (campaignsData.campaigns || [])
      
      // Create campaign lookup
      const campaignLookup: Record<number, string> = {}
      for (const c of campaigns) {
        const name = c.settings?.name || c.name
        if (name) {
          campaignLookup[c.id] = name
        }
      }
      
      // Result structure
      const campaignResults: Record<string, { 
        campaignId: number
        campaignName: string
        products: Record<string, { count: number, commission?: number }>
        outcomes: Record<string, number>
      }> = {}
      
      // Track new mappings to create
      const mappingsToCreate: { campaignId: string; campaignName: string; outcome: string }[] = []
      
      // 1. Get products from /sales endpoint - fetch multiple pages
      const now = new Date()
      const scanStartDate = new Date(now.getTime() - scanDays * 24 * 60 * 60 * 1000)
      const filters = { created: { $gt: scanStartDate.toISOString() } }
      const filterStr = encodeURIComponent(JSON.stringify(filters))
      
      let allSales: unknown[] = []
      let page = 1
      const pageSize = 100
      
      while (page <= 10) { // Max 10 pages = 1000 sales
        try {
          console.log(`Fetching sales page ${page}...`)
          const salesResponse = await fetch(`${baseUrl}/sales?pageSize=${pageSize}&page=${page}&filters=${filterStr}`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (salesResponse.status === 429) {
            console.log('Rate limited on sales fetch, stopping pagination')
            break
          }
          
          if (salesResponse.ok) {
            const salesData = await salesResponse.json()
            const sales = Array.isArray(salesData) ? salesData : (salesData.sales || [])
            
            if (sales.length === 0) break
            
            allSales = [...allSales, ...sales]
            console.log(`Page ${page}: Got ${sales.length} sales, total: ${allSales.length}`)
            
            if (sales.length < pageSize) break
            page++
            
            // Small delay between pages
            await new Promise(r => setTimeout(r, 500))
          } else {
            console.error(`Failed to fetch sales page ${page}:`, await salesResponse.text())
            break
          }
        } catch (e) {
          console.log('Error fetching sales page:', e)
          break
        }
      }
      
      console.log(`Total sales fetched: ${allSales.length}`)
      
      // Process sales - extract campaign + line.title combinations
      for (const sale of allSales as { campaignId?: number; campaign?: number; lines?: { title?: string; salesCommission?: number }[] }[]) {
        const campaignId = sale.campaignId || sale.campaign
        if (!campaignId) continue
        
        const campaignName = campaignLookup[campaignId] || `Unknown (${campaignId})`
        
        if (!campaignResults[campaignId]) {
          campaignResults[campaignId] = { campaignId, campaignName, products: {}, outcomes: {} }
        }
        
        if (sale.lines && Array.isArray(sale.lines)) {
          for (const line of sale.lines) {
            const title = line.title
            if (!title) continue
            
            // Track product with count
            if (!campaignResults[campaignId].products[title]) {
              campaignResults[campaignId].products[title] = { count: 0, commission: line.salesCommission }
              
              // Add to mappings to create
              mappingsToCreate.push({
                campaignId: String(campaignId),
                campaignName,
                outcome: title
              })
            }
            campaignResults[campaignId].products[title].count++
          }
        }
      }
      
      // 2. Load existing mappings to avoid duplicates
      const { data: existingMappings } = await supabase
        .from('campaign_product_mappings')
        .select('adversus_campaign_id, adversus_outcome')
      
      const existingKeys = new Set(
        (existingMappings || []).map(m => `${m.adversus_campaign_id}|${m.adversus_outcome || ''}`)
      )
      
      // 3. Create new mappings for campaign+product combinations
      const newMappings = mappingsToCreate.filter(m => {
        const key = `${m.campaignId}|${m.outcome}`
        return !existingKeys.has(key)
      })
      
      let mappingsCreated = 0
      if (newMappings.length > 0) {
        console.log(`Creating ${newMappings.length} new campaign-product mappings...`)
        
        // Insert in batches of 50
        for (let i = 0; i < newMappings.length; i += 50) {
          const batch = newMappings.slice(i, i + 50).map(m => ({
            adversus_campaign_id: m.campaignId,
            adversus_campaign_name: m.campaignName,
            adversus_outcome: m.outcome,
            product_id: null
          }))
          
          const { error } = await supabase
            .from('campaign_product_mappings')
            .insert(batch)
          
          if (error) {
            console.error('Error creating mappings batch:', error)
          } else {
            mappingsCreated += batch.length
          }
        }
        
        console.log(`Created ${mappingsCreated} new mappings`)
      }
      
      return new Response(
        JSON.stringify({ 
          campaigns: Object.values(campaignResults).filter(c => 
            Object.keys(c.products).length > 0 || Object.keys(c.outcomes).length > 0
          ),
          allCampaigns: campaigns.map((c: { id: number; name: string; settings?: { name?: string } }) => ({ 
            id: c.id, 
            name: c.settings?.name || c.name 
          })),
          totalCampaigns: campaigns.length,
          mappingsCreated,
          totalSalesScanned: allSales.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Debug action: fetch specific campaign details
    if (debugAction === 'fetch-campaign' && debugCampaignId) {
      console.log(`Debug: Fetching Adversus campaign ${debugCampaignId}...`)
      const campaignResponse = await fetch(`${baseUrl}/campaigns/${debugCampaignId}`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })
      
      const responseText = await campaignResponse.text()
      console.log(`Campaign response: ${responseText}`)
      
      return new Response(
        JSON.stringify({ campaign: JSON.parse(responseText) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Syncing data from ${startDate} to ${endDate}`)

    // Load all active products for matching
    const { data: products } = await supabase
      .from('products')
      .select('id, code, name, commission_type, commission_value')
      .eq('is_active', true)
    
    console.log(`Loaded ${products?.length || 0} active products for matching`)

    // Load existing campaign mappings
    const { data: existingMappings } = await supabase
      .from('campaign_product_mappings')
      .select('*')
    
    // Key: "campaignId|outcome" (outcome can be empty string for null)
    const campaignMappingsByKey = new Map<string, CampaignMapping>()
    if (existingMappings) {
      for (const mapping of existingMappings) {
        const key = `${mapping.adversus_campaign_id}|${mapping.adversus_outcome || ''}`
        campaignMappingsByKey.set(key, mapping as CampaignMapping)
      }
    }
    console.log(`Loaded ${existingMappings?.length || 0} existing campaign mappings`)

    // Step 1: Fetch campaigns from Adversus (including resultFields)
    console.log('Fetching campaigns from Adversus...')
    const campaignsResponse = await fetch(`${baseUrl}/campaigns`, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    })

    const campaignMap = new Map<number, AdversusCampaign>()
    const campaignResultFieldsMap = new Map<number, ResultField[]>()
    
    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json()
      console.log('Campaigns API response structure:', JSON.stringify(campaignsData).slice(0, 1000))
      const campaigns: AdversusCampaign[] = campaignsData.campaigns || campaignsData || []
      console.log(`Found ${campaigns.length} campaigns in Adversus`)
      
      for (const campaign of campaigns) {
        // Get campaign name from settings.name (Adversus API structure)
        const campaignName = campaign.settings?.name || campaign.name
        
        if (!campaignName) {
          console.log(`Skipping campaign ${campaign.id} - no name found`)
          continue
        }
        
        // Store the resolved name and resultFields for later use
        const resolvedCampaign = { ...campaign, name: campaignName }
        campaignMap.set(campaign.id, resolvedCampaign)
        
        // Store result fields for outcome extraction
        if (campaign.resultFields && campaign.resultFields.length > 0) {
          campaignResultFieldsMap.set(campaign.id, campaign.resultFields)
          console.log(`Campaign ${campaign.id} (${campaignName}) has ${campaign.resultFields.length} result fields:`)
          for (const field of campaign.resultFields) {
            console.log(`  - Field ${field.id}: ${field.name || field.type} (type: ${field.type})`)
          }
        }
      }
    } else {
      console.warn('Could not fetch campaigns from Adversus:', await campaignsResponse.text())
    }

    // Helper to delay between requests to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Step 2: Sync users/agents from Adversus (with retry logic)
    console.log('Fetching users from Adversus...')
    
    let usersResponse: Response | null = null
    let userRetries = 0
    const maxUserRetries = 3
    let usersRateLimited = false
    
    while (userRetries < maxUserRetries) {
      usersResponse = await fetch(`${baseUrl}/users`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (usersResponse.status === 429) {
        userRetries++
        const waitTime = userRetries * 5000 // 5s, 10s, 15s
        console.warn(`Rate limited on users fetch, waiting ${waitTime}ms before retry ${userRetries}/${maxUserRetries}`)
        await delay(waitTime)
      } else {
        break
      }
    }

    let agentsCreated = 0
    let agentsUpdated = 0
    
    if (!usersResponse || !usersResponse.ok) {
      const errorText = usersResponse ? await usersResponse.text() : 'No response'
      console.warn('Could not fetch users from Adversus, continuing with existing agents:', usersResponse?.status, errorText)
      usersRateLimited = true
      // Continue with existing agents instead of failing
    } else {
    const usersData = await usersResponse.json()
      const allUsers: AdversusUser[] = usersData.users || usersData
      console.log(`Found ${allUsers.length} total users in Adversus`)
      
      // Log first user structure to understand the data
      if (allUsers.length > 0) {
        console.log('Sample user structure:', JSON.stringify(allUsers[0]).slice(0, 500))
      }
      
      // Filter to only include agents (exclude managers)
      // Handle various role formats: string, object, array
      const users = allUsers.filter(user => {
        // Safely extract role as string
        let roleStr = ''
        if (typeof user.role === 'string') {
          roleStr = user.role.toLowerCase()
        } else if (user.role && typeof user.role === 'object') {
          // Role might be an object with name/type property
          const roleObj = user.role as Record<string, unknown>
          roleStr = String(roleObj.name || roleObj.type || roleObj.id || '').toLowerCase()
        }
        
        // Safely extract accessLevel
        let accessStr = ''
        if (typeof user.accessLevel === 'string') {
          accessStr = user.accessLevel.toLowerCase()
        } else if (user.accessLevel && typeof user.accessLevel === 'object') {
          const accessObj = user.accessLevel as Record<string, unknown>
          accessStr = String(accessObj.name || accessObj.type || '').toLowerCase()
        }
        
        // Exclude if explicitly marked as manager or admin
        const isManager = roleStr.includes('manager') || roleStr.includes('admin') || 
                         accessStr.includes('manager') || accessStr.includes('admin') ||
                         user.isManager === true
        
        if (isManager) {
          console.log(`Skipping manager: ${user.name} (role: ${JSON.stringify(user.role)})`)
          return false
        }
        return true
      })
      
      console.log(`Filtered to ${users.length} agents (excluded ${allUsers.length - users.length} managers)`)

      // Upsert agents
      for (const user of users) {
        const agentData = {
          external_adversus_id: String(user.id),
          name: user.name || user.displayName,
          email: user.email || `agent-${user.id}@adversus.local`,
          is_active: user.active
        }

        // Check if agent exists
        const { data: existingAgent } = await supabase
          .from('agents')
          .select('id')
          .eq('external_adversus_id', String(user.id))
          .maybeSingle()

        if (existingAgent) {
          await supabase
            .from('agents')
            .update(agentData)
            .eq('id', existingAgent.id)
          agentsUpdated++
        } else {
          await supabase
            .from('agents')
            .insert(agentData)
          agentsCreated++
        }
      }
    }

    console.log(`Agents synced: ${agentsCreated} created, ${agentsUpdated} updated (managers excluded)${usersRateLimited ? ' (rate limited, using existing)' : ''}`)

    // Step 3: Fetch sessions (calls) from Adversus
    console.log('Fetching sessions from Adversus...')
    
    // Only fetch successful sessions to reduce data and API calls
    const filters = JSON.stringify({
      startTime: { $gt: startDate, $lt: endDate },
      status: 'success'
    })
    
    console.log('Filters:', filters)
    
    let page = 1
    const pageSize = 100
    let totalSessions = 0
    let salesCreated = 0
    let salesUpdated = 0
    let unmatchedSales = 0
    let newMappingsCreated = 0
    let leadsFetched = 0
    const productMatchStats: Record<string, number> = {}
    const outcomeStats: Record<string, number> = {}

    // Get fallback product
    const { data: fallbackProduct } = await supabase
      .from('products')
      .select('id, code, name, commission_type, commission_value')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    // Track which campaign+outcome combinations we've already created in this sync
    const createdMappingsThisSync = new Set<string>()
    
    // Cache for lead data to avoid duplicate fetches
    const leadCache = new Map<number, AdversusLead | null>()
    
    // Cache for Adversus sales data by leadId
    const salesCache = new Map<number, { productTitles: string[], totalPrice: number } | null>()

    // Helper function to fetch sales for a lead from Adversus /sales endpoint
    async function fetchSalesForLead(leadId: number): Promise<{ productTitles: string[], totalPrice: number } | null> {
      if (salesCache.has(leadId)) {
        return salesCache.get(leadId) || null
      }
      
      await delay(200)
      
      try {
        // Try multiple filter formats for leadId (Adversus API can be inconsistent)
        const filterFormats = [
          { leadid: { $eq: leadId } },
          { lead: { $eq: leadId } },
          { leadId: { $eq: leadId } }
        ]
        
        for (const filter of filterFormats) {
          const salesResponse = await fetch(`${baseUrl}/sales?filters=${encodeURIComponent(JSON.stringify(filter))}`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (salesResponse.ok) {
            const salesData = await salesResponse.json()
            const sales = Array.isArray(salesData) ? salesData : (salesData.sales || [])
            
            if (sales.length > 0) {
              // Get the most recent sale
              const sale = sales[0]
              const productTitles: string[] = []
              
              // Extract product titles from sale lines
              if (sale.lines && Array.isArray(sale.lines)) {
                for (const line of sale.lines) {
                  if (line.title) {
                    productTitles.push(line.title)
                  }
                }
              }
              
              // Also check for product field directly on sale
              if (sale.product && typeof sale.product === 'string') {
                productTitles.push(sale.product)
              }
              if (sale.productName) {
                productTitles.push(sale.productName)
              }
              
              if (productTitles.length > 0) {
                console.log(`✓ Found Adversus sale for lead ${leadId}: ${productTitles.join(', ')}`)
                const result = { productTitles, totalPrice: sale.totalNetPrice || sale.totalPrice || 0 }
                salesCache.set(leadId, result)
                return result
              }
            }
          }
        }
        
        // Log when no sales found for debugging
        console.log(`⚠ No Adversus sales found for lead ${leadId}`)
        salesCache.set(leadId, null)
        return null
      } catch (err) {
        console.warn(`Error fetching sales for lead ${leadId}:`, err)
        salesCache.set(leadId, null)
        return null
      }
    }

    // Helper function to fetch lead data
    async function fetchLead(leadId: number, campaignId?: number): Promise<AdversusLead | null> {
      if (leadCache.has(leadId)) {
        return leadCache.get(leadId) || null
      }
      
      // Add small delay before fetching lead to avoid rate limits
      await delay(200)
      
      try {
        const leadResponse = await fetch(`${baseUrl}/leads/${leadId}`, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (leadResponse.ok) {
          const leadData = await leadResponse.json()
          // Handle both direct object and array response
          const lead = Array.isArray(leadData) ? leadData[0] : (leadData.leads ? leadData.leads[0] : leadData)
          
          // Log first 5 leads with ALL fields to find product selection
          if (leadsFetched < 5) {
            console.log(`=== FULL LEAD DATA ${leadId} (Campaign: ${campaignId}) ===`)
            console.log('Lead keys:', Object.keys(lead || {}))
            console.log('status:', lead?.status)
            console.log('result:', lead?.result)
            console.log('outcome:', lead?.outcome)
            console.log('closingCode:', lead?.closingCode)
            console.log('product:', lead?.product)
            // Log any field that might contain product info
            for (const key of Object.keys(lead || {})) {
              if (key !== 'resultData' && key !== 'contactData') {
                console.log(`  ${key}:`, JSON.stringify(lead[key]))
              }
            }
            console.log('resultData:', JSON.stringify(lead?.resultData || [], null, 2))
            console.log(`=== END FULL LEAD ${leadId} ===`)
          }
          
          leadCache.set(leadId, lead)
          leadsFetched++
          return lead
        } else {
          console.warn(`Could not fetch lead ${leadId}: ${leadResponse.status}`)
          leadCache.set(leadId, null)
          return null
        }
      } catch (err) {
        console.warn(`Error fetching lead ${leadId}:`, err)
        leadCache.set(leadId, null)
        return null
      }
    }

    // Helper function to extract outcome from lead resultData
    function extractOutcome(lead: AdversusLead | null, campaignId: number): string | null {
      if (!lead) {
        return null
      }
      
      // Priority 0: Check direct fields on lead object (e.g., from success dropdown)
      if (lead.result && typeof lead.result === 'string' && lead.result.trim()) {
        console.log(`✓ Found outcome from lead.result: ${lead.result}`)
        return lead.result.trim()
      }
      if (lead.outcome && typeof lead.outcome === 'string' && lead.outcome.trim()) {
        console.log(`✓ Found outcome from lead.outcome: ${lead.outcome}`)
        return lead.outcome.trim()
      }
      if (lead.closingCode && typeof lead.closingCode === 'string' && lead.closingCode.trim()) {
        console.log(`✓ Found outcome from lead.closingCode: ${lead.closingCode}`)
        return lead.closingCode.trim()
      }
      if (lead.product && typeof lead.product === 'string' && lead.product.trim()) {
        console.log(`✓ Found outcome from lead.product: ${lead.product}`)
        return lead.product.trim()
      }
      if (lead.selectedProduct && typeof lead.selectedProduct === 'string' && lead.selectedProduct.trim()) {
        console.log(`✓ Found outcome from lead.selectedProduct: ${lead.selectedProduct}`)
        return lead.selectedProduct.trim()
      }
      
      // Check any field on lead that might contain product/outcome info
      const leadAny = lead as unknown as Record<string, unknown>
      for (const key of Object.keys(leadAny)) {
        const val = leadAny[key]
        if (typeof val === 'string' && val.trim()) {
          const keyLower = key.toLowerCase()
          if (keyLower.includes('product') || keyLower.includes('outcome') || 
              keyLower.includes('result') || keyLower.includes('closing')) {
            console.log(`✓ Found outcome from lead.${key}: ${val}`)
            return val.trim()
          }
        }
      }
      
      // Log ALL resultData fields for debugging (only for first few leads)
      if (lead.resultData && lead.resultData.length > 0) {
        console.log(`=== ALL RESULTDATA FIELDS FOR LEAD (Campaign: ${campaignId}) ===`)
        for (const rd of lead.resultData) {
          console.log(`  Field "${rd.label}" (id: ${rd.id}): "${rd.value}"`)
        }
        console.log(`=== END RESULTDATA ===`)
        
        // Priority 1: Look for field labeled "Produkter" - this contains the closing code/product
        for (const rd of lead.resultData) {
          const labelLower = (rd.label || '').toLowerCase()
          if (labelLower === 'produkter' || labelLower === 'produkt' || 
              labelLower.includes('afslutning') || labelLower.includes('mødetype') ||
              labelLower.includes('meeting') || labelLower.includes('booking')) {
            if (rd.value && rd.value.trim()) {
              console.log(`✓ Found outcome from "${rd.label}": ${rd.value.trim()}`)
              return rd.value.trim()
            }
          }
        }
        
        // Priority 2: Look for "Succes" fields (like "FF Succes:", "Succes:", etc.)
        for (const rd of lead.resultData) {
          const labelLower = (rd.label || '').toLowerCase()
          if (labelLower.includes('succes') && !labelLower.includes('note')) {
            if (rd.value && rd.value.trim()) {
              console.log(`✓ Found outcome from succes field "${rd.label}": ${rd.value.trim()}`)
              return rd.value.trim()
            }
          }
        }
        
        // Priority 3: Look for fields containing product-like values
        for (const rd of lead.resultData) {
          const valueLower = (rd.value || '').toLowerCase()
          // Check if value looks like a product name (contains keywords)
          if (valueLower.includes('fysisk') || valueLower.includes('telefon') || 
              valueLower.includes('video') || valueLower.includes('online') ||
              valueLower.includes('mobil') || valueLower.includes('fiber') ||
              valueLower.includes('5g') || valueLower.includes('omstilling')) {
            console.log(`✓ Found outcome from value match "${rd.label}": ${rd.value.trim()}`)
            return rd.value.trim()
          }
        }
        
        // Priority 4: Look for other outcome-like fields
        for (const rd of lead.resultData) {
          const labelLower = (rd.label || '').toLowerCase()
          if (labelLower.includes('outcome') || 
              labelLower.includes('resultat') ||
              labelLower.includes('udfald') ||
              labelLower.includes('type')) {
            if (rd.value && rd.value.trim()) {
              console.log(`✓ Found outcome from "${rd.label}": ${rd.value.trim()}`)
              return rd.value.trim()
            }
          }
        }
      }
      
      return null
    }

    // Helper function to extract phone number from lead data
    function extractPhoneNumber(lead: AdversusLead | null): string | null {
      if (!lead) return null
      
      // Check common phone fields
      if (lead.phoneNumbers && lead.phoneNumbers.length > 0) {
        return lead.phoneNumbers[0]
      }
      if (lead.phone) return lead.phone
      if (lead.mobile) return lead.mobile
      
      // Check contactData object
      if (lead.contactData) {
        if (lead.contactData.phoneNumbers && Array.isArray(lead.contactData.phoneNumbers) && lead.contactData.phoneNumbers.length > 0) {
          return lead.contactData.phoneNumbers[0]
        }
        if (lead.contactData.phone) return lead.contactData.phone
        if (lead.contactData.mobile) return lead.contactData.mobile
      }
      
      // Check resultData for phone fields
      if (lead.resultData) {
        for (const rd of lead.resultData) {
          const labelLower = (rd.label || '').toLowerCase()
          if (labelLower.includes('telefon') || labelLower.includes('phone') || labelLower.includes('mobil') || labelLower.includes('tlf')) {
            if (rd.value && rd.value.trim()) {
              return rd.value.trim()
            }
          }
        }
      }
      
      return null
    }

    while (true) {
      const sessionsUrl = `${baseUrl}/sessions?filters=${encodeURIComponent(filters)}&page=${page}&pageSize=${pageSize}&sortProperty=startTime&sortDirection=DESC`
      
      let sessionsResponse: Response | null = null
      let retries = 0
      const maxRetries = 3
      
      while (retries < maxRetries) {
        sessionsResponse = await fetch(sessionsUrl, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (sessionsResponse.status === 429) {
          // Rate limited - wait and retry with exponential backoff
          const waitTime = Math.pow(2, retries) * 5000 // 5s, 10s, 20s
          console.log(`Rate limited on page ${page}, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`)
          await delay(waitTime)
          retries++
          continue
        }
        
        break
      }

      if (!sessionsResponse || !sessionsResponse.ok) {
        const errorText = sessionsResponse ? await sessionsResponse.text() : 'No response'
        console.error('Failed to fetch sessions:', sessionsResponse?.status, errorText)
        break
      }

      const sessionsData = await sessionsResponse.json()
      
      // Handle both array response and object with sessions property
      let sessions: AdversusSession[] = []
      if (Array.isArray(sessionsData)) {
        sessions = sessionsData
      } else if (sessionsData && typeof sessionsData === 'object') {
        sessions = sessionsData.sessions || sessionsData.data || []
        if (sessionsData.meta) {
          console.log('Sessions meta:', JSON.stringify(sessionsData.meta))
        }
      }
      
      if (!sessions || sessions.length === 0) {
        console.log('No more sessions to process')
        break
      }

      totalSessions += sessions.length
      console.log(`Processing page ${page} with ${sessions.length} sessions`)

      // Positive outcome keywords to filter by
      const POSITIVE_OUTCOMES = [
        'ja tak', 'succes', 'success', 'sale', 'salg', 'solgt', 'booket', 
        'booking', 'aftale', 'ja', 'yes', 'accept', 'godkendt', 'ok',
        'bestilt', 'købt', 'abonnement', 'gennemført', 'done', 'completed'
      ]
      
      function isPositiveOutcome(outcome: string | null): boolean {
        if (!outcome) return false
        const outcomeLower = outcome.toLowerCase()
        return POSITIVE_OUTCOMES.some(positive => outcomeLower.includes(positive))
      }

      for (const session of sessions) {
        // Only process "success" sessions as sales
        // Note: session.status === 'success' from Adversus already means it's a completed sale
        if (session.status !== 'success') continue

        // Fetch lead data to get outcome/product info
        const lead = await fetchLead(session.leadId, session.campaignId)
        
        // Try to get product info from Adversus /sales endpoint first
        const salesData = await fetchSalesForLead(session.leadId)
        
        // Use sales product titles as outcome if available, otherwise fall back to lead resultData
        let outcome: string | null = null
        if (salesData && salesData.productTitles.length > 0) {
          outcome = salesData.productTitles.join(', ')
        } else {
          outcome = extractOutcome(lead, session.campaignId)
        }
        
        // Track outcome statistics (for debugging)
        if (outcome) {
          outcomeStats[outcome] = (outcomeStats[outcome] || 0) + 1
        }
        
        // Note: We no longer skip based on positive outcome - session.status='success' is enough

        // Find the agent by Adversus user ID
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .eq('external_adversus_id', String(session.userId))
          .maybeSingle()

        if (!agent) {
          console.warn(`Agent not found for Adversus user ${session.userId}`)
          continue
        }

        const campaign = campaignMap.get(session.campaignId)
        const campaignName = campaign?.name || `Unknown Campaign ${session.campaignId}`
        const customerPhone = extractPhoneNumber(lead)
        
        // Create campaign+outcome mapping if it doesn't exist
        const mappingKey = `${session.campaignId}|${outcome || ''}`
        if (!campaignMappingsByKey.has(mappingKey) && !createdMappingsThisSync.has(mappingKey)) {
          const { data: newMapping, error: mappingError } = await supabase
            .from('campaign_product_mappings')
            .insert({
              adversus_campaign_id: String(session.campaignId),
              adversus_campaign_name: campaignName,
              adversus_outcome: outcome,
              product_id: null
            })
            .select()
            .maybeSingle()
          
          if (mappingError) {
            // Might be duplicate, try to fetch it
            console.warn(`Failed to create mapping for ${mappingKey}:`, mappingError.message)
          } else if (newMapping) {
            campaignMappingsByKey.set(mappingKey, newMapping as CampaignMapping)
            newMappingsCreated++
            console.log(`Created new mapping: ${campaignName} + ${outcome || '(no outcome)'}`)
          }
          createdMappingsThisSync.add(mappingKey)
        }

        // Find matching product - first check manual mapping, then auto-match
        let matchedProduct: Product | null = null
        
        // Check for manual mapping first (exact campaign+outcome match)
        const manualMapping = campaignMappingsByKey.get(mappingKey)
        if (manualMapping?.product_id && products) {
          matchedProduct = products.find(p => p.id === manualMapping.product_id) as Product || null
          if (matchedProduct) {
            console.log(`Using manual mapping for ${campaignName} + ${outcome || '(no outcome)'}: ${matchedProduct.name}`)
          }
        }
        
        // Fall back to auto-matching if no manual mapping
        if (!matchedProduct && campaign && products) {
          matchedProduct = findMatchingProduct(campaign.name, outcome || undefined, products as Product[])
        }
        
        // Use fallback if no match found
        const productToUse = matchedProduct || (fallbackProduct as Product | null)
        
        if (!productToUse) {
          console.warn(`No product found for session ${session.id}, campaign: ${campaignName}, outcome: ${outcome}`)
          unmatchedSales++
          continue
        }

        // Track product match statistics
        const productKey = productToUse.code
        productMatchStats[productKey] = (productMatchStats[productKey] || 0) + 1

        const saleData = {
          agent_id: agent.id,
          product_id: productToUse.id,
          adversus_call_id: String(session.id),
          customer_id: String(session.leadId),
          sale_date: session.startTime,
          effective_date: session.endTime,
          status: 'active' as const,
          campaign_name: campaignName,
          customer_phone: customerPhone,
          outcome: outcome
        }

        // Check if sale already exists
        const { data: existingSale } = await supabase
          .from('sales')
          .select('id, status')
          .eq('adversus_call_id', String(session.id))
          .maybeSingle()

        if (existingSale) {
          // Update existing sale if needed
          await supabase
            .from('sales')
            .update(saleData)
            .eq('id', existingSale.id)
          salesUpdated++
        } else {
          // Create new sale
          const { data: newSale, error: saleError } = await supabase
            .from('sales')
            .insert(saleData)
            .select()
            .single()

          if (saleError) {
            console.error('Failed to create sale:', saleError)
            continue
          }

          // Create commission transaction for the sale
          if (newSale) {
            const commissionAmount = productToUse.commission_type === 'fixed' 
              ? productToUse.commission_value 
              : (newSale.sale_amount || 0) * (productToUse.commission_value || 0) / 100

            await supabase
              .from('commission_transactions')
              .insert({
                sale_id: newSale.id,
                agent_id: agent.id,
                type: 'earn',
                amount: commissionAmount,
                reason: `Commission for ${productToUse.name}`
              })
          }

          salesCreated++
        }
      }

      if (sessions.length < pageSize) {
        break
      }
      page++
      
      // Add delay between pages to avoid rate limiting (1.5s to stay under per-minute limits)
      await delay(1500)
    }

    console.log(`Sessions processed: ${totalSessions} total, ${salesCreated} sales created, ${salesUpdated} updated, ${unmatchedSales} unmatched`)
    console.log(`Leads fetched: ${leadsFetched}`)
    console.log('Product match stats:', JSON.stringify(productMatchStats))
    console.log('Outcome stats:', JSON.stringify(outcomeStats))

    const result = {
      success: true,
      summary: {
        agents: { created: agentsCreated, updated: agentsUpdated },
        sessions: { processed: totalSessions, salesCreated, salesUpdated, unmatchedSales },
        campaigns: { total: campaignMap.size },
        mappings: { created: newMappingsCreated },
        leads: { fetched: leadsFetched },
        productMatches: productMatchStats,
        outcomeStats,
        dateRange: { startDate, endDate }
      }
    }

    console.log('Sync completed successfully:', result)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
