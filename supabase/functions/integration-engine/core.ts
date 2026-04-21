import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StandardSale, StandardUser, StandardCampaign, StandardCall, StandardSession, CampaignMappingConfig } from "./types.ts";
import { processUsers as coreProcessUsers } from "./core/users.ts";
import { processCampaigns as coreProcessCampaigns } from "./core/campaigns.ts";
import { processSales as coreProcessSales } from "./core/sales.ts";
import { processCalls as coreProcessCalls } from "./core/calls.ts";
import { processSessions as coreProcessSessions } from "./core/sessions.ts";
import { getCampaignMappings as coreGetCampaignMappings } from "./core/mappings.ts";

export class IngestionEngine {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }

  private log(type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) {
    console.log(JSON.stringify({ type, msg, data, timestamp: new Date().toISOString() }));
  }

  async getCampaignMappings(): Promise<CampaignMappingConfig[]> {
    return coreGetCampaignMappings(this.supabase);
  }

  async processUsers(users: StandardUser[], source: "adversus" | "enreach" = "adversus", allowedDomains?: string[]) {
    return coreProcessUsers(this.supabase, users, this.log.bind(this), source, allowedDomains);
  }

  async processCampaigns(campaigns: StandardCampaign[]) {
    return coreProcessCampaigns(this.supabase, campaigns, this.log.bind(this));
  }

  async processSales(sales: StandardSale[], batchSize = 500) {
    return coreProcessSales(this.supabase, sales, batchSize, this.log.bind(this));
  }

  async processCalls(calls: StandardCall[], integrationId: string, batchSize = 500) {
    return coreProcessCalls(this.supabase, calls, integrationId, batchSize, this.log.bind(this));
  }

  async processSessions(sessions: StandardSession[], integrationId: string, batchSize = 500) {
    return coreProcessSessions(this.supabase, sessions, integrationId, batchSize, this.log.bind(this));
  }
}
