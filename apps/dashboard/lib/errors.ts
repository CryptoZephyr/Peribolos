/**
 * Pull the most specific human message out of an error, whatever shape it is.
 *
 * The libraries in play throw three different things:
 *   - viem/wagmi: BaseError with `.details` / `.shortMessage`, and a `.message`
 *     that buries the real reason on a "Details:" line below a generic first line.
 *   - Circle App Kit: a `KitError` (an Error subclass) with `.message` + `.code`.
 *   - wallet providers: sometimes a plain object with `.message` or `.reason`
 *     and no Error prototype at all.
 *
 * Naive handling (`err.message.split("\n")[0]` or `String(err)`) produces either
 * a useless generic line or, for plain objects, the dreaded "[object Object]".
 * This walks known string fields regardless of prototype, digs into `cause`, and
 * only ever falls back to a readable generic — never "[object Object]".
 */
export function describeError(err: unknown): string {
  if (err == null) return "Something went wrong.";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any;

  if (typeof e === "string") return trim(e);

  // Known string-bearing fields, most specific first. App Kit KitError uses
  // `.message`; viem uses `.details`/`.shortMessage`; providers use `.reason`.
  const fields = [e.details, e.shortMessage, e.reason, e.message, e.error?.message];
  for (const f of fields) {
    if (typeof f === "string" && f.trim()) {
      const detail = f
        .split("\n")
        .map((l: string) => l.trim())
        .find((l: string) => l.startsWith("Details:"));
      const picked = detail ? detail.replace(/^Details:\s*/, "") : f.split("\n")[0];
      const code = typeof e.code === "string" || typeof e.code === "number" ? e.code : undefined;
      return trim(code && !picked.includes(String(code)) ? `${picked}` : picked);
    }
  }

  // Walk one level into a nested cause.
  if (e.cause && e.cause !== e) {
    const nested = describeError(e.cause);
    if (nested && nested !== "Something went wrong.") return nested;
  }

  // Last resort: serialize, but never surface "[object Object]".
  try {
    const json = JSON.stringify(e);
    if (json && json !== "{}" && json !== "[object Object]") return trim(json);
  } catch {
    // circular / non-serializable — fall through
  }
  return "Something went wrong. Open the browser console for the full error.";
}

function trim(s: string): string {
  return s.slice(0, 220);
}
