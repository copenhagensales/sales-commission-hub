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
  outcome?: string
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
}

interface AdversusCampaign {
  id: number
  name: string
  active: boolean
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

    // Parse request body for date range
    let startDate: string | null = null
    let endDate: string | null = null
    
    try {
      const body = await req.json()
      startDate = body.startDate
      endDate = body.endDate
    } catch {
      // Use default date range (last 30 days)
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = thirtyDaysAgo.toISOString()
      endDate = now.toISOString()
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
    
    const campaignMappingsByAdversusId = new Map<string, CampaignMapping>()
    if (existingMappings) {
      for (const mapping of existingMappings) {
        campaignMappingsByAdversusId.set(mapping.adversus_campaign_id, mapping as CampaignMapping)
      }
    }
    console.log(`Loaded ${existingMappings?.length || 0} existing campaign mappings`)

    // Step 1: Fetch campaigns from Adversus
    console.log('Fetching campaigns from Adversus...')
    const campaignsResponse = await fetch(`${baseUrl}/campaigns`, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    })

    const campaignMap = new Map<number, AdversusCampaign>()
    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json()
      console.log('Campaigns API response structure:', JSON.stringify(campaignsData).slice(0, 500))
      const campaigns: AdversusCampaign[] = campaignsData.campaigns || campaignsData || []
      console.log(`Found ${campaigns.length} campaigns in Adversus`)
      
      // Log first campaign object structure to understand the API
      if (campaigns.length > 0) {
        console.log('First campaign object:', JSON.stringify(campaigns[0]))
      }
      
      for (const campaign of campaigns) {
        // Skip campaigns without a name
        if (!campaign.name) {
          console.log(`Skipping campaign ${campaign.id} - no name`)
          continue
        }
        
        campaignMap.set(campaign.id, campaign)
        console.log(`Campaign ${campaign.id}: ${campaign.name}`)
        
        // Upsert campaign mapping if not exists
        if (!campaignMappingsByAdversusId.has(String(campaign.id))) {
          const { error: mappingError } = await supabase
            .from('campaign_product_mappings')
            .upsert({
              adversus_campaign_id: String(campaign.id),
              adversus_campaign_name: campaign.name,
              product_id: null
            }, {
              onConflict: 'adversus_campaign_id'
            })
          
          if (mappingError) {
            console.warn(`Failed to create mapping for campaign ${campaign.id}:`, mappingError)
          }
        }
      }
      
      // Reload mappings after potential inserts
      const { data: updatedMappings } = await supabase
        .from('campaign_product_mappings')
        .select('*')
      
      if (updatedMappings) {
        campaignMappingsByAdversusId.clear()
        for (const mapping of updatedMappings) {
          campaignMappingsByAdversusId.set(mapping.adversus_campaign_id, mapping as CampaignMapping)
        }
      }
    } else {
      console.warn('Could not fetch campaigns from Adversus')
    }

    // Step 2: Sync users/agents from Adversus
    console.log('Fetching users from Adversus...')
    const usersResponse = await fetch(`${baseUrl}/users`, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    })

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text()
      console.error('Failed to fetch users:', usersResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${usersResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const usersData = await usersResponse.json()
    const users: AdversusUser[] = usersData.users || usersData
    console.log(`Found ${users.length} users in Adversus`)

    // Upsert agents
    let agentsCreated = 0
    let agentsUpdated = 0
    
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

    console.log(`Agents synced: ${agentsCreated} created, ${agentsUpdated} updated`)

    // Step 3: Fetch sessions (calls) from Adversus
    console.log('Fetching sessions from Adversus...')
    
    const filters = JSON.stringify({
      startTime: { $gt: startDate, $lt: endDate }
    })
    
    let page = 1
    const pageSize = 100
    let totalSessions = 0
    let salesCreated = 0
    let salesUpdated = 0
    let unmatchedSales = 0
    const productMatchStats: Record<string, number> = {}

    // Get fallback product
    const { data: fallbackProduct } = await supabase
      .from('products')
      .select('id, code, name, commission_type, commission_value')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    while (true) {
      const sessionsUrl = `${baseUrl}/sessions?filters=${encodeURIComponent(filters)}&page=${page}&pageSize=${pageSize}&sortProperty=startTime&sortDirection=DESC`
      
      const sessionsResponse = await fetch(sessionsUrl, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })

      if (!sessionsResponse.ok) {
        const errorText = await sessionsResponse.text()
        console.error('Failed to fetch sessions:', sessionsResponse.status, errorText)
        break
      }

      const sessionsData = await sessionsResponse.json()
      console.log('Sessions response type:', typeof sessionsData, Array.isArray(sessionsData))
      
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

      for (const session of sessions) {
        // Only process "success" sessions as sales
        if (session.status !== 'success') continue

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

        // Find matching product - first check manual mapping, then auto-match
        const campaign = campaignMap.get(session.campaignId)
        let matchedProduct: Product | null = null
        
        // Check for manual mapping first
        const manualMapping = campaignMappingsByAdversusId.get(String(session.campaignId))
        if (manualMapping?.product_id && products) {
          matchedProduct = products.find(p => p.id === manualMapping.product_id) as Product || null
          if (matchedProduct) {
            console.log(`Using manual mapping for campaign ${campaign?.name}: ${matchedProduct.name}`)
          }
        }
        
        // Fall back to auto-matching if no manual mapping
        if (!matchedProduct && campaign && products) {
          matchedProduct = findMatchingProduct(campaign.name, session.outcome, products as Product[])
        }
        
        // Use fallback if no match found
        const productToUse = matchedProduct || (fallbackProduct as Product | null)
        
        if (!productToUse) {
          console.warn(`No product found for session ${session.id}, campaign: ${campaign?.name}`)
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
          status: 'active' as const
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
    }

    console.log(`Sessions processed: ${totalSessions} total, ${salesCreated} sales created, ${salesUpdated} updated, ${unmatchedSales} unmatched`)
    console.log('Product match stats:', JSON.stringify(productMatchStats))

    const result = {
      success: true,
      summary: {
        agents: { created: agentsCreated, updated: agentsUpdated },
        sessions: { processed: totalSessions, salesCreated, salesUpdated, unmatchedSales },
        campaigns: { total: campaignMap.size },
        productMatches: productMatchStats,
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
