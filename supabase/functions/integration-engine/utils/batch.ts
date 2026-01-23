import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/**
 * Generisk pagineret fetch fra Supabase.
 * Håndterer automatisk 1000-rækkers grænsen.
 */
export async function fetchAllPaginated<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: (query: any) => any,
  options: { 
    pageSize?: number; 
    orderBy?: string; 
    ascending?: boolean;
  } = {}
): Promise<T[]> {
  const { pageSize = 500, orderBy = "created_at", ascending = true } = options;
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending })
      .range(offset, offset + pageSize - 1);

    query = filters(query);
    
    const { data, error } = await query;

    if (error) {
      console.error(`[fetchAllPaginated] Error on ${table} at offset ${offset}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      offset += data.length;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`[fetchAllPaginated] Fetched ${allData.length} rows from ${table} in ${Math.ceil(offset / pageSize) || 1} page(s)`);
  return allData;
}

