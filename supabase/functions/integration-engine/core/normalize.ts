import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Field definition from data_field_definitions table
 */
export interface FieldDefinition {
  id: string;
  field_key: string;
  display_name: string;
  category: string;
  data_type: string;
  is_pii: boolean;
  is_required: boolean;
  is_hidden: boolean;
  retention_days: number | null;
}

/**
 * Field mapping from integration_field_mappings table
 */
export interface FieldMapping {
  id: string;
  integration_id: string;
  source_field_path: string;
  target_field_id: string | null;
  is_excluded: boolean;
  transform_rule: Record<string, unknown> | null;
}

/**
 * Result of applying data mappings to raw data
 */
export interface NormalizationResult {
  normalizedData: Record<string, unknown>;
  piiFields: string[];
  excludedFields: string[];
  retentionRules: Map<string, number | null>;
}

/**
 * Cache for field definitions and mappings to avoid repeated DB calls
 */
interface MappingsCache {
  fieldDefinitions: Map<string, FieldDefinition>;
  integrationMappings: Map<string, FieldMapping[]>;
  lastFetch: number;
}

const CACHE_TTL_MS = 60000; // 1 minute cache
let cache: MappingsCache | null = null;

/**
 * Get a value from nested object using dot notation path
 * e.g., "lead.phone" -> rawData.lead.phone
 * Also supports array notation like "leadResultData[0].value"
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array index notation like "leadResultData[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[parseInt(indexStr, 10)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  return current;
}

/**
 * Fetch field definitions and mappings from database
 */
async function fetchMappingsFromDb(
  supabase: SupabaseClient,
  integrationId: string
): Promise<{ definitions: FieldDefinition[]; mappings: FieldMapping[] }> {
  const [defResult, mapResult] = await Promise.all([
    supabase.from("data_field_definitions").select("*"),
    supabase
      .from("integration_field_mappings")
      .select("*")
      .eq("integration_id", integrationId),
  ]);

  return {
    definitions: (defResult.data as FieldDefinition[]) || [],
    mappings: (mapResult.data as FieldMapping[]) || [],
  };
}

/**
 * Get mappings with caching
 */
async function getMappings(
  supabase: SupabaseClient,
  integrationId: string,
  forceRefresh = false
): Promise<{ definitions: Map<string, FieldDefinition>; mappings: FieldMapping[] }> {
  const now = Date.now();
  
  // Check cache validity
  if (
    !forceRefresh &&
    cache &&
    now - cache.lastFetch < CACHE_TTL_MS &&
    cache.integrationMappings.has(integrationId)
  ) {
    return {
      definitions: cache.fieldDefinitions,
      mappings: cache.integrationMappings.get(integrationId)!,
    };
  }

  const { definitions, mappings } = await fetchMappingsFromDb(supabase, integrationId);

  // Update cache
  const definitionsMap = new Map(definitions.map((d) => [d.id, d]));
  
  if (!cache) {
    cache = {
      fieldDefinitions: definitionsMap,
      integrationMappings: new Map(),
      lastFetch: now,
    };
  } else {
    cache.fieldDefinitions = definitionsMap;
    cache.lastFetch = now;
  }
  cache.integrationMappings.set(integrationId, mappings);

  return { definitions: definitionsMap, mappings };
}

/**
 * Apply data mappings to transform raw API data into normalized format.
 * 
 * @param supabase - Supabase client
 * @param integrationId - ID of the integration (dialer_integrations.id)
 * @param rawData - Raw data object from the API
 * @param log - Logging function
 * @returns Normalized data with PII tracking and retention rules
 */
export async function applyDataMappings(
  supabase: SupabaseClient,
  integrationId: string,
  rawData: Record<string, unknown>,
  log?: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
): Promise<NormalizationResult> {
  const result: NormalizationResult = {
    normalizedData: {},
    piiFields: [],
    excludedFields: [],
    retentionRules: new Map(),
  };

  try {
    const { definitions, mappings } = await getMappings(supabase, integrationId);

    // If no mappings configured, return empty result
    if (mappings.length === 0) {
      log?.("INFO", `No field mappings configured for integration ${integrationId}`);
      return result;
    }

    for (const mapping of mappings) {
      const sourcePath = mapping.source_field_path;
      
      // Handle excluded fields
      if (mapping.is_excluded) {
        result.excludedFields.push(sourcePath);
        continue;
      }

      // Skip if no target field
      if (!mapping.target_field_id) continue;

      const fieldDef = definitions.get(mapping.target_field_id);
      if (!fieldDef) {
        log?.("WARN", `Field definition not found for ${mapping.target_field_id}`);
        continue;
      }

      // Check retention_days = 0 (never store)
      if (fieldDef.retention_days === 0) {
        result.excludedFields.push(sourcePath);
        log?.("INFO", `Field ${fieldDef.field_key} has retention_days=0, skipping storage`);
        continue;
      }

      // Extract value from raw data
      let value = getValueByPath(rawData, sourcePath);

      // Apply transform rule if configured
      if (mapping.transform_rule && value !== undefined) {
        value = applyTransform(value, mapping.transform_rule);
      }

      // Only add if value exists
      if (value !== undefined && value !== null && value !== '') {
        result.normalizedData[fieldDef.field_key] = value;

        // Track PII fields
        if (fieldDef.is_pii) {
          result.piiFields.push(fieldDef.field_key);
        }

        // Track retention rules
        if (fieldDef.retention_days !== null) {
          result.retentionRules.set(fieldDef.field_key, fieldDef.retention_days);
        }
      }
    }

    log?.("INFO", `Normalized ${Object.keys(result.normalizedData).length} fields, ${result.excludedFields.length} excluded, ${result.piiFields.length} PII`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log?.("ERROR", `Error applying data mappings: ${errMsg}`);
  }

  return result;
}

/**
 * Apply a transform rule to a value
 */
function applyTransform(value: unknown, rule: Record<string, unknown>): unknown {
  const ruleType = rule.type as string;

  switch (ruleType) {
    case 'regex': {
      // Extract using regex pattern
      const pattern = rule.pattern as string;
      const groupIndex = (rule.groupIndex as number) || 1;
      if (typeof value === 'string') {
        const match = value.match(new RegExp(pattern));
        return match?.[groupIndex] ?? value;
      }
      return value;
    }
    case 'format': {
      // Simple string format
      const template = rule.template as string;
      return template.replace('{value}', String(value));
    }
    case 'default': {
      // Return default if value is empty
      const defaultValue = rule.defaultValue;
      if (value === undefined || value === null || value === '') {
        return defaultValue;
      }
      return value;
    }
    case 'map': {
      // Map values using a lookup table
      const mapping = rule.mapping as Record<string, unknown>;
      if (mapping && typeof value === 'string' && value in mapping) {
        return mapping[value];
      }
      return value;
    }
    default:
      return value;
  }
}

/**
 * Get list of fields that should be excluded based on mappings
 */
export async function getExcludedFieldPaths(
  supabase: SupabaseClient,
  integrationId: string
): Promise<string[]> {
  const { mappings, definitions } = await getMappings(supabase, integrationId);
  
  const excluded: string[] = [];
  
  for (const mapping of mappings) {
    // Explicitly excluded
    if (mapping.is_excluded) {
      excluded.push(mapping.source_field_path);
      continue;
    }
    
    // Check if target field has retention_days = 0
    if (mapping.target_field_id) {
      const fieldDef = definitions.get(mapping.target_field_id);
      if (fieldDef?.retention_days === 0) {
        excluded.push(mapping.source_field_path);
      }
    }
  }
  
  return excluded;
}

/**
 * Check if an integration has active field mappings configured
 */
export async function hasActiveMappings(
  supabase: SupabaseClient,
  integrationId: string
): Promise<boolean> {
  const { mappings } = await getMappings(supabase, integrationId);
  return mappings.some((m) => m.target_field_id !== null && !m.is_excluded);
}

/**
 * Clear the mappings cache (useful for testing or when config changes)
 */
export function clearMappingsCache(): void {
  cache = null;
}
