import { supabase } from "@/integrations/supabase/client";

/**
 * Generisk pagineret fetch fra Supabase.
 * Håndterer automatisk 1000-rækkers grænsen.
 * 
 * @example
 * // Simpel brug
 * const sales = await fetchAllRows<Sale>("sales", "id, agent_email, sale_datetime");
 * 
 * @example
 * // Med filtre og options
 * const sales = await fetchAllRows<Sale>(
 *   "sales",
 *   "id, agent_email, sale_datetime, sale_items(*)",
 *   (query) => query.gte("sale_datetime", startDate).lte("sale_datetime", endDate),
 *   { pageSize: 500, orderBy: "sale_datetime", ascending: false }
 * );
 */
export async function fetchAllRows<T = unknown>(
  table: string,
  select: string,
  filters?: (query: any) => any,
  options: {
    pageSize?: number;
    orderBy?: string;
    ascending?: boolean;
    maxRows?: number; // Optional safety limit
  } = {}
): Promise<T[]> {
  const { 
    pageSize = 500, 
    orderBy = "created_at", 
    ascending = true,
    maxRows 
  } = options;
  
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Check if we've hit the optional max rows limit
    if (maxRows && allData.length >= maxRows) {
      console.log(`[fetchAllRows] Reached maxRows limit of ${maxRows}`);
      break;
    }

    let query = (supabase as any)
      .from(table)
      .select(select)
      .order(orderBy, { ascending })
      .range(offset, offset + pageSize - 1);

    // Apply custom filters if provided
    if (filters) {
      query = filters(query);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[fetchAllRows] Error on ${table} at offset ${offset}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      offset += data.length;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  if (allData.length > 1000) {
    console.log(`[fetchAllRows] Fetched ${allData.length} rows from ${table} (paginated)`);
  }
  
  return allData;
}

/**
 * Tæl totalt antal rækker i en tabel med filtre.
 * Bruger count() som er mere effektivt end at hente alle rækker.
 * 
 * @example
 * const count = await countRows("sales", (q) => q.gte("sale_datetime", startDate));
 */
export async function countRows(
  table: string,
  filters?: (query: any) => any
): Promise<number> {
  let query = (supabase as any)
    .from(table)
    .select("*", { count: "exact", head: true });

  if (filters) {
    query = filters(query);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`[countRows] Error counting ${table}:`, error);
    throw error;
  }

  return count || 0;
}

/**
 * Batch insert/upsert data i chunks for at undgå request size limits.
 * 
 * @example
 * await batchUpsert("kpi_cached_values", data, { onConflict: "slug,scope_type,scope_id" });
 */
export async function batchUpsert<T extends Record<string, unknown>>(
  table: string,
  data: T[],
  options: {
    chunkSize?: number;
    onConflict?: string;
  } = {}
): Promise<void> {
  const { chunkSize = 200, onConflict } = options;
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    
    const query = onConflict
      ? (supabase as any).from(table).upsert(chunk, { onConflict })
      : (supabase as any).from(table).upsert(chunk);
    
    const { error } = await query;
    
    if (error) {
      console.error(`[batchUpsert] Error at chunk ${i / chunkSize}:`, error);
      throw error;
    }
  }
}

/**
 * Split et array i mindre chunks.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Hent data i batches baseret på en liste af IDs.
 * Nyttig når du har mange IDs og vil undgå "URI too long" fejl.
 * 
 * @example
 * const items = await fetchByIds<SaleItem>("sale_items", "sale_id", saleIds, "id, quantity, product_id");
 */
export async function fetchByIds<T = unknown>(
  table: string,
  idColumn: string,
  ids: string[],
  select: string,
  options: { chunkSize?: number } = {}
): Promise<T[]> {
  const { chunkSize = 200 } = options;
  const chunks = chunk(ids, chunkSize);
  const allData: T[] = [];

  for (const idChunk of chunks) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .in(idColumn, idChunk);

    if (error) {
      console.error(`[fetchByIds] Error fetching from ${table}:`, error);
      throw error;
    }

    if (data) {
      allData.push(...(data as T[]));
    }
  }

  return allData;
}

/**
 * Cursor-based pagination for better performance on large datasets.
 * Uses WHERE id > last_id instead of OFFSET for constant query time.
 * 
 * @example
 * const sales = await fetchAllRowsCursor<Sale>(
 *   "sales",
 *   "id, agent_email, sale_datetime",
 *   (query) => query.gte("sale_datetime", startDate),
 *   { cursorColumn: "id", pageSize: 500 }
 * );
 */
export async function fetchAllRowsCursor<T = unknown>(
  table: string,
  select: string,
  filters?: (query: any) => any,
  options: {
    pageSize?: number;
    cursorColumn?: string;
    maxRows?: number;
  } = {}
): Promise<T[]> {
  const { pageSize = 500, cursorColumn = "id", maxRows } = options;
  const allData: T[] = [];
  let lastCursor: string | null = null;

  while (true) {
    if (maxRows && allData.length >= maxRows) {
      console.log(`[fetchAllRowsCursor] Reached maxRows limit of ${maxRows}`);
      break;
    }

    let query = (supabase as any)
      .from(table)
      .select(select)
      .order(cursorColumn, { ascending: true })
      .limit(pageSize);

    if (lastCursor) {
      query = query.gt(cursorColumn, lastCursor);
    }

    if (filters) {
      query = filters(query);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[fetchAllRowsCursor] Error on ${table}:`, error);
      throw error;
    }

    if (!data || data.length === 0) break;

    allData.push(...(data as T[]));
    lastCursor = (data[data.length - 1] as any)[cursorColumn];

    if (data.length < pageSize) break;
  }

  if (allData.length > 1000) {
    console.log(`[fetchAllRowsCursor] Fetched ${allData.length} rows from ${table} (cursor-paginated)`);
  }

  return allData;
}
