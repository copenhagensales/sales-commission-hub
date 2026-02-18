interface FetchAllPostgrestRowsOptions {
  pageSize?: number;
  retries?: number;
  retryDelayMs?: number;
  maxPages?: number;
  maxRows?: number;
  onMaxRowsExceeded?: "truncate" | "error";
  requestTimeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelayMs(response: Response | null, attempt: number, retryDelayMs: number): number {
  const retryAfterHeader = response?.headers.get("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const expBackoff = retryDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * retryDelayMs);
  return expBackoff + jitter;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number,
  retryDelayMs: number,
  requestTimeoutMs: number
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response;

      try {
        response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (response.ok) return response;

      const isRetryableStatus = response.status === 429 || response.status >= 500;
      if (isRetryableStatus && attempt < retries) {
        await sleep(getRetryDelayMs(response, attempt, retryDelayMs));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error(`PostgREST request timed out after ${requestTimeoutMs}ms`);
      }

      if (attempt < retries) {
        await sleep(getRetryDelayMs(null, attempt, retryDelayMs));
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
  const {
    pageSize = 500,
    retries = 4,
    retryDelayMs = 500,
    maxPages = 10000,
    maxRows,
    onMaxRowsExceeded = "error",
    requestTimeoutMs = 30000,
  } = options;

  const baseUrl = new URL(rawUrl);
  baseUrl.searchParams.delete("limit");
  baseUrl.searchParams.delete("offset");

  const allRows: T[] = [];
  let knownTotalCount: number | null = null;
  let reachedMaxPages = true;

  for (let page = 0; page < maxPages; page += 1) {
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
      retryDelayMs,
      requestTimeoutMs
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostgREST fetch failed (${response.status}): ${errorText}`);
    }

    if (page === 0) {
      knownTotalCount = parseTotalCount(response.headers.get("content-range"));
    }

    const rows = (await response.json()) as T[];
    if (!rows.length) {
      reachedMaxPages = false;
      break;
    }

    allRows.push(...rows);

    if (maxRows && allRows.length >= maxRows) {
      if (onMaxRowsExceeded === "error") {
        throw new Error(`PostgREST fetch exceeded max rows (${maxRows}) for URL: ${baseUrl.toString()}`);
      }
      return allRows.slice(0, maxRows);
    }

    if (rows.length < pageSize) {
      reachedMaxPages = false;
      break;
    }

    if (knownTotalCount !== null && allRows.length >= knownTotalCount) {
      reachedMaxPages = false;
      break;
    }
  }

  if (reachedMaxPages) {
    throw new Error(`PostgREST fetch exceeded max pages (${maxPages}) for URL: ${baseUrl.toString()}`);
  }

  return allRows;
}
