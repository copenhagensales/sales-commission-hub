import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DebugLogItem {
  raw: Record<string, unknown>;
  registered: boolean;
  skipReason?: string;
}

export interface DebugLogStats {
  total: number;
  registered: number;
  skipped: number;
  skipReasons: Record<string, number>;
}

export interface DebugLogEntry {
  provider: string;
  syncType: string;
  rawItems: DebugLogItem[];
  registeredItems: DebugLogItem[];
  skippedItems: DebugLogItem[];
  stats: DebugLogStats;
}

/**
 * Saves debug log entry to the database.
 * Uses UPSERT with unique constraint on (provider, sync_type) so it replaces itself each sync.
 */
export async function saveDebugLog(
  supabase: SupabaseClient,
  entry: DebugLogEntry
): Promise<void> {
  try {
    const { error } = await supabase
      .from("integration_debug_log")
      .upsert(
        {
          provider: entry.provider,
          sync_type: entry.syncType,
          sync_started_at: new Date().toISOString(),
          sync_completed_at: new Date().toISOString(),
          raw_items: entry.rawItems,
          registered_items: entry.registeredItems,
          skipped_items: entry.skippedItems,
          stats: entry.stats,
        },
        {
          onConflict: "provider,sync_type",
        }
      );

    if (error) {
      console.error(`[DebugLog] Failed to save debug log for ${entry.provider}/${entry.syncType}:`, error.message);
    } else {
      console.log(
        `[DebugLog] Saved debug log for ${entry.provider}/${entry.syncType}: ` +
        `${entry.stats.total} total, ${entry.stats.registered} registered, ${entry.stats.skipped} skipped`
      );
    }
  } catch (e) {
    console.error(`[DebugLog] Exception saving debug log:`, e);
  }
}

/**
 * Creates a DebugLogEntry from raw leads and processed sales.
 */
export function createDebugLogEntry(
  provider: string,
  syncType: string,
  rawLeads: Record<string, unknown>[],
  processedSales: { externalId: string }[],
  skipReasonMap: Map<string, string> // externalId -> reason
): DebugLogEntry {
  const processedIds = new Set(processedSales.map(s => s.externalId));
  
  const rawItems: DebugLogItem[] = [];
  const registeredItems: DebugLogItem[] = [];
  const skippedItems: DebugLogItem[] = [];
  const skipReasons: Record<string, number> = {};

  for (const lead of rawLeads) {
    const externalId = String(
      lead.uniqueId || lead.UniqueId || lead.id || lead.Id || lead.externalId || ""
    ).trim();
    
    const isRegistered = externalId ? processedIds.has(externalId) : false;
    const skipReason = externalId ? skipReasonMap.get(externalId) : "no_external_id";
    
    const item: DebugLogItem = {
      raw: lead,
      registered: isRegistered,
      skipReason: isRegistered ? undefined : skipReason,
    };
    
    rawItems.push(item);
    
    if (isRegistered) {
      registeredItems.push(item);
    } else {
      skippedItems.push(item);
      const reason = skipReason || "unknown";
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;
    }
  }

  return {
    provider,
    syncType,
    rawItems,
    registeredItems,
    skippedItems,
    stats: {
      total: rawItems.length,
      registered: registeredItems.length,
      skipped: skippedItems.length,
      skipReasons,
    },
  };
}
