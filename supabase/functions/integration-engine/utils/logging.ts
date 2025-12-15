export function makeLogger(context: Record<string, unknown>) {
  return (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => {
    console.log(JSON.stringify({ type, msg, data, context, timestamp: new Date().toISOString() }))
  }
}

