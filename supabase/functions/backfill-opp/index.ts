import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPP_FIELD_ID = 80862;
const BATCH_SIZE = 10;
const DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

/**
 * Validates if a value is a valid OPP number.
 * Valid OPP numbers are:
 * - Starts with "OPP-" (case insensitive)
 * - Is exactly 4-6 digits long
 * 
 * Invalid examples (Lead IDs): 950265538 (9 digits)
 */
function isValidOppNumber(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  
  // Valid if starts with "OPP-" (case insensitive)
  if (trimmed.toUpperCase().startsWith('OPP-')) {
    return true;
  }
  
  // Valid if exactly 4-6 digits (pure numeric OPP codes)
  const digitsOnly = /^\d{4,6}$/;
  if (digitsOnly.test(trimmed)) {
    return true;
  }
  
  // Anything else (like 9-digit Lead IDs) is invalid
  console.log(`   ⚠️ Valor rechazado como OPP (parece Lead ID): "${trimmed}" (${trimmed.length} caracteres)`);
  return false;
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('='.repeat(60));
  console.log('🚀 BACKFILL-OPP: Iniciando proceso');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adversusUsername = Deno.env.get('ADVERSUS_API_USERNAME');
    const adversusPassword = Deno.env.get('ADVERSUS_API_PASSWORD');
    
    if (!adversusUsername || !adversusPassword) {
      console.error('❌ Error: Credenciales de Adversus no configuradas');
      throw new Error('Adversus credentials not configured');
    }
    console.log('✅ Credenciales de Adversus verificadas');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = btoa(`${adversusUsername}:${adversusPassword}`);
    const baseUrl = 'https://api.adversus.io/v1';

    // Find ALL sales without OPP number (all clients)
    console.log('\n📊 Buscando ventas sin número OPP (todos los clientes)...');
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id, 
        adversus_external_id, 
        adversus_event_id
      `)
      .is('adversus_opp_number', null)
      .not('adversus_event_id', 'is', null)
      .limit(BATCH_SIZE);

    if (salesError) {
      console.error('❌ Error al buscar ventas:', salesError.message);
      throw salesError;
    }

    console.log(`📋 Ventas encontradas: ${sales?.length || 0}`);

    if (!sales || sales.length === 0) {
      const duration = Date.now() - startTime;
      console.log('\n' + '='.repeat(60));
      console.log('📊 RESUMEN FINAL - BACKFILL-OPP');
      console.log('='.repeat(60));
      console.log('✅ Estado: Completado - No hay ventas pendientes');
      console.log(`⏱️  Duración: ${formatDuration(duration)}`);
      console.log('='.repeat(60));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No sales without OPP number found',
          processed: 0,
          summary: {
            duration_ms: duration,
            duration_formatted: formatDuration(duration)
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n🔄 Procesando ${sales.length} ventas...\n`);

    // Stats tracking
    const stats = {
      processed: 0,
      successful: 0,
      noOppFound: 0,
      errors: 0,
      rateLimited: false,
      apiCalls: 0
    };

    const results: { 
      saleId: string; 
      externalId: string | null;
      oppNumber: string | null; 
      status: 'success' | 'no_opp' | 'error';
      error?: string;
      processingTime?: number;
    }[] = [];

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const saleStartTime = Date.now();
      stats.processed++;
      
      console.log(`\n[${i + 1}/${sales.length}] Procesando venta ${sale.adversus_external_id || sale.id}`);
      
      try {
        // Get lead ID from the adversus event
        const { data: event } = await supabase
          .from('adversus_events')
          .select('payload')
          .eq('id', sale.adversus_event_id)
          .maybeSingle();

        if (!event) {
          console.log(`   ⚠️ Evento no encontrado para sale_id: ${sale.id}`);
          stats.errors++;
          results.push({ 
            saleId: sale.id, 
            externalId: sale.adversus_external_id,
            oppNumber: null, 
            status: 'error',
            error: 'Event not found',
            processingTime: Date.now() - saleStartTime
          });
          continue;
        }

        const leadId = (event.payload as any)?.payload?.lead?.id;
        if (!leadId) {
          console.log(`   ⚠️ No lead ID en evento para venta ${sale.adversus_external_id}`);
          stats.errors++;
          results.push({ 
            saleId: sale.id, 
            externalId: sale.adversus_external_id,
            oppNumber: null, 
            status: 'error',
            error: 'No lead ID in event',
            processingTime: Date.now() - saleStartTime
          });
          continue;
        }

        console.log(`   📡 Llamando API Adversus para lead ${leadId}...`);
        await sleep(DELAY_MS);
        stats.apiCalls++;

        const leadResponse = await fetch(`${baseUrl}/leads/${leadId}`, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        });

        if (!leadResponse.ok) {
          const status = leadResponse.status;
          console.error(`   ❌ Error API (${status}) para lead ${leadId}`);
          stats.errors++;
          results.push({ 
            saleId: sale.id, 
            externalId: sale.adversus_external_id,
            oppNumber: null, 
            status: 'error',
            error: `API error: ${status}`,
            processingTime: Date.now() - saleStartTime
          });
          
          if (status === 429) {
            console.log('   🚫 Rate limited - Deteniendo batch');
            stats.rateLimited = true;
            break;
          }
          continue;
        }

        const leadData = await leadResponse.json();
        const lead = Array.isArray(leadData) ? leadData[0] : (leadData.leads ? leadData.leads[0] : leadData);

        if (!lead) {
          console.log(`   ⚠️ Lead no encontrado en respuesta Adversus`);
          stats.errors++;
          results.push({ 
            saleId: sale.id, 
            externalId: sale.adversus_external_id,
            oppNumber: null, 
            status: 'error',
            error: 'Lead not found in Adversus',
            processingTime: Date.now() - saleStartTime
          });
          continue;
        }

        // Extract OPP number with strict validation
        let oppNumber: string | null = null;
        const resultData = Array.isArray(lead.resultData) ? lead.resultData : [];

        if (resultData.length > 0) {
          const byId = resultData.find(
            (rd: { id?: number; value?: string }) => 
              rd && rd.id === OPP_FIELD_ID && typeof rd.value === 'string' && rd.value.trim()
          );

          if (byId) {
            const candidateValue = (byId.value as string).trim();
            // Validate before accepting
            if (isValidOppNumber(candidateValue)) {
              oppNumber = candidateValue;
            } else {
              console.log(`   ⚠️ Campo ${OPP_FIELD_ID} contiene valor inválido: "${candidateValue}"`);
            }
          } else {
            const byLabel = resultData.find(
              (rd: { label?: string; value?: string }) =>
                rd &&
                typeof rd.label === 'string' &&
                String(rd.label).toLowerCase().includes('opp') &&
                typeof rd.value === 'string' &&
                rd.value.trim()
            );

            if (byLabel) {
              const candidateValue = (byLabel.value as string).trim();
              // Validate before accepting
              if (isValidOppNumber(candidateValue)) {
                oppNumber = candidateValue;
              } else {
                console.log(`   ⚠️ Campo OPP por label contiene valor inválido: "${candidateValue}"`);
              }
            }
          }
        }

        if (oppNumber) {
          const { error: updateError } = await supabase
            .from('sales')
            .update({ adversus_opp_number: oppNumber })
            .eq('id', sale.id);

          if (updateError) {
            console.error(`   ❌ Error actualizando BD: ${updateError.message}`);
            stats.errors++;
            results.push({ 
              saleId: sale.id, 
              externalId: sale.adversus_external_id,
              oppNumber: null, 
              status: 'error',
              error: updateError.message,
              processingTime: Date.now() - saleStartTime
            });
          } else {
            console.log(`   ✅ OPP encontrado y guardado: ${oppNumber}`);
            stats.successful++;
            results.push({ 
              saleId: sale.id, 
              externalId: sale.adversus_external_id,
              oppNumber, 
              status: 'success',
              processingTime: Date.now() - saleStartTime
            });
          }
        } else {
          // Mark as checked by setting empty string to avoid re-processing
          await supabase
            .from('sales')
            .update({ adversus_opp_number: '' })
            .eq('id', sale.id);
          console.log(`   ⚪ Sin OPP en Adversus - marcado como procesado`);
          stats.noOppFound++;
          results.push({ 
            saleId: sale.id, 
            externalId: sale.adversus_external_id,
            oppNumber: null, 
            status: 'no_opp',
            error: 'No OPP in Adversus',
            processingTime: Date.now() - saleStartTime
          });
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Error inesperado: ${errorMsg}`);
        stats.errors++;
        results.push({ 
          saleId: sale.id, 
          externalId: sale.adversus_external_id,
          oppNumber: null, 
          status: 'error',
          error: errorMsg,
          processingTime: Date.now() - saleStartTime
        });
      }
    }

    // Count remaining sales without OPP (all clients)
    const { count: remaining } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .is('adversus_opp_number', null)
      .not('adversus_event_id', 'is', null);

    const duration = Date.now() - startTime;
    const avgTimePerSale = stats.processed > 0 ? Math.round(duration / stats.processed) : 0;

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL - BACKFILL-OPP');
    console.log('='.repeat(60));
    console.log(`📋 Ventas procesadas:     ${stats.processed}`);
    console.log(`✅ OPP encontrados:       ${stats.successful}`);
    console.log(`⚪ Sin OPP en Adversus:   ${stats.noOppFound}`);
    console.log(`❌ Errores:               ${stats.errors}`);
    console.log(`📡 Llamadas API:          ${stats.apiCalls}`);
    console.log(`⏱️  Duración total:        ${formatDuration(duration)}`);
    console.log(`⚡ Promedio por venta:    ${formatDuration(avgTimePerSale)}`);
    console.log(`📦 Ventas restantes:      ${remaining || 0}`);
    if (stats.rateLimited) {
      console.log(`🚫 Rate limited:          Sí (batch detenido)`);
    }
    console.log('='.repeat(60));
    
    // Log individual results summary
    if (stats.successful > 0) {
      console.log('\n✅ OPPs encontrados:');
      results.filter(r => r.status === 'success').forEach(r => {
        console.log(`   - ${r.externalId}: ${r.oppNumber}`);
      });
    }
    
    if (stats.errors > 0) {
      console.log('\n❌ Errores detallados:');
      results.filter(r => r.status === 'error').forEach(r => {
        console.log(`   - ${r.externalId || r.saleId}: ${r.error}`);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: stats.processed,
        successful: stats.successful,
        noOppFound: stats.noOppFound,
        errors: stats.errors,
        remaining: remaining || 0,
        rateLimited: stats.rateLimited,
        summary: {
          duration_ms: duration,
          duration_formatted: formatDuration(duration),
          avg_per_sale_ms: avgTimePerSale,
          api_calls: stats.apiCalls
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log('\n' + '='.repeat(60));
    console.log('❌ BACKFILL-OPP: ERROR FATAL');
    console.log('='.repeat(60));
    console.error(`Error: ${errorMessage}`);
    console.log(`⏱️ Duración hasta error: ${formatDuration(duration)}`);
    console.log('='.repeat(60));
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        summary: {
          duration_ms: duration,
          duration_formatted: formatDuration(duration)
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
