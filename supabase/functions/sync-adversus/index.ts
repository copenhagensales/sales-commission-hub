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
  resultData?: Array<{ id: number; value: string; label?: string }>
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
      const users: AdversusUser[] = usersData.users || usersData
      console.log(`Found ${users.length} users in Adversus`)

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

    console.log(`Agents synced: ${agentsCreated} created, ${agentsUpdated} updated${usersRateLimited ? ' (rate limited, using existing)' : ''}`)

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
          
          // Log Codan campaign leads (105575) or first 3 leads
          const isCodan = campaignId === 105575
          if (isCodan || leadsFetched < 3) {
            console.log(`=== LEAD ${leadId} (Campaign: ${campaignId}${isCodan ? ' CODAN' : ''}) ===`)
            console.log('resultData:', JSON.stringify(lead?.resultData || [], null, 2))
            console.log(`=== END LEAD ${leadId} ===`)
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
      if (!lead || !lead.resultData || lead.resultData.length === 0) {
        return null
      }
      
      // First, look for field labeled "Produkter" - this is where outcome/afslutningskode is stored
      for (const rd of lead.resultData) {
        const labelLower = (rd.label || '').toLowerCase()
        if (labelLower === 'produkter' || labelLower === 'produkt' || labelLower.includes('afslutning')) {
          if (rd.value && rd.value.trim()) {
            console.log(`Found outcome from "${rd.label}": ${rd.value.trim()}`)
            return rd.value.trim()
          }
        }
      }
      
      // Fallback: look for other outcome-like fields
      for (const rd of lead.resultData) {
        const labelLower = (rd.label || '').toLowerCase()
        if (labelLower.includes('outcome') || 
            labelLower.includes('resultat') ||
            labelLower.includes('type')) {
          if (rd.value && rd.value.trim()) {
            console.log(`Found outcome from "${rd.label}": ${rd.value.trim()}`)
            return rd.value.trim()
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

      for (const session of sessions) {
        // Only process "success" sessions as sales
        if (session.status !== 'success') continue

        // Fetch lead data to get outcome
        const lead = await fetchLead(session.leadId, session.campaignId)
        const outcome = extractOutcome(lead, session.campaignId)
        
        // Track outcome statistics
        if (outcome) {
          outcomeStats[outcome] = (outcomeStats[outcome] || 0) + 1
        }

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
