interface FetchAllPostgrestRowsOptions {
  pageSize?: number;
  retries?: number;
  retryDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, init: RequestInit, retries: number, retryDelayMs: number): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;

      if (response.status >= 500 && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("PostgREST fetch failed");
}

function parseTotalCount(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const totalPart = contentRange.split("/")[1];
  if (!totalPart || totalPart === "*") return null;
  const parsed = Number(totalPart);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Fetch all PostgREST rows using limit+offset paging.
 * Removes built-in 10k/Range one-shot limits from client-side fetches.
 */
export async function fetchAllPostgrestRows<T = unknown>(
  rawUrl: string,
  headers: Record<string, string>,
  options: FetchAllPostgrestRowsOptions = {}
): Promise<T[]> {
  const { pageSize = 500, retries = 2, retryDelayMs = 250 } = options;

  const baseUrl = new URL(rawUrl);
  baseUrl.searchParams.delete("limit");
  baseUrl.searchParams.delete("offset");

  const allRows: T[] = [];
  let knownTotalCount: number | null = null;

  for (let page = 0; ; page += 1) {
    const pageUrl = new URL(baseUrl.toString());
    pageUrl.searchParams.set("limit", String(pageSize));
    pageUrl.searchParams.set("offset", String(page * pageSize));

    const response = await fetchWithRetry(
      pageUrl.toString(),
      {
        headers: {
          ...headers,
          ...(page === 0 ? { Prefer: "count=exact" } : {}),
        },
      },
      retries,
      retryDelayMs
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostgREST fetch failed (${response.status}): ${errorText}`);
    }

    if (page === 0) {
      knownTotalCount = parseTotalCount(response.headers.get("content-range"));
    }

    const rows = (await response.json()) as T[];
    if (!rows.length) break;

    allRows.push(...rows);

    if (rows.length < pageSize) break;

    if (knownTotalCount !== null && allRows.length >= knownTotalCount) {
      break;
    }
  }

  return allRows;
}
