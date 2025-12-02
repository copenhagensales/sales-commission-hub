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

    // Step 1: Sync users/agents from Adversus
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

    // Step 2: Fetch sessions (calls) from Adversus
    console.log('Fetching sessions from Adversus...')
    
    const filters = JSON.stringify({
      startTime: { $gt: startDate, $lt: endDate }
    })
    
    let page = 1
    const pageSize = 100
    let totalSessions = 0
    let salesCreated = 0
    let salesUpdated = 0

    // Get default product for sales
    const { data: defaultProduct } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!defaultProduct) {
      console.warn('No active product found. Please create a product first.')
    }

    while (true) {
      const sessionsUrl = `${baseUrl}/sessions?filters=${encodeURIComponent(filters)}&page=${page}&pageSize=${pageSize}&sortProperty=startTime&sortDirection=DESC`
      
      const sessionsResponse = await fetch(sessionsUrl, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      })

      if (!sessionsResponse.ok) {
        console.error('Failed to fetch sessions:', sessionsResponse.status)
        break
      }

      const sessions: AdversusSession[] = await sessionsResponse.json()
      
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

        const saleData = {
          agent_id: agent.id,
          product_id: defaultProduct?.id,
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
          if (defaultProduct && newSale) {
            const { data: product } = await supabase
              .from('products')
              .select('commission_type, commission_value')
              .eq('id', defaultProduct.id)
              .single()

            if (product) {
              const commissionAmount = product.commission_type === 'fixed' 
                ? product.commission_value 
                : (newSale.sale_amount || 0) * (product.commission_value || 0) / 100

              await supabase
                .from('commission_transactions')
                .insert({
                  sale_id: newSale.id,
                  agent_id: agent.id,
                  type: 'earn',
                  amount: commissionAmount,
                  reason: 'Initial commission for sale'
                })
            }
          }

          salesCreated++
        }
      }

      if (sessions.length < pageSize) {
        break
      }
      page++
    }

    console.log(`Sessions processed: ${totalSessions} total, ${salesCreated} sales created, ${salesUpdated} updated`)

    const result = {
      success: true,
      summary: {
        agents: { created: agentsCreated, updated: agentsUpdated },
        sessions: { processed: totalSessions, salesCreated, salesUpdated },
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
