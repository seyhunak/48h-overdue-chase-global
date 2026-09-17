// Feature switches (SERVER ONLY — read at request runtime, never baked in).
// DEBUG_MODE=true forces debug logging on. In development debug is on by
// default so local work is unaffected; in production it stays off unless the
// flag is explicitly set. No other behavior is gated — adding a new switch
// means adding one function here, not scattering env reads.

function rawFlag(name: string): string {
  try {
    return (process.env[name] ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
}

export function isDebugMode(): boolean {
  const v = rawFlag("DEBUG_MODE");
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return isDev();
}

export function debugLog(...args: unknown[]): void {
  if (!isDebugMode()) return;
  try {
    console.log(...args);
  } catch {
    // logging must never break the request
  }
}
