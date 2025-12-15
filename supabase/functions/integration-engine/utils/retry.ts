export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; factor?: number } = {}
): Promise<T> {
  const { retries = 3, baseMs = 100, factor = 2 } = opts
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e) {
      attempt++
      if (attempt > retries) throw e
      const wait = baseMs * Math.pow(factor, attempt - 1)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

