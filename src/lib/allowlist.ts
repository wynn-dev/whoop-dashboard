// The dashboard is private to exactly one WHOOP account. Both the OAuth
// callback and every session lookup go through this comparison, so nobody
// else can connect, and an existing session stops working if the allowed
// address changes.
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function isAllowedEmail(email: string, allowed: string) {
  const candidate = normalizeEmail(email)
  return candidate.length > 0 && candidate === normalizeEmail(allowed)
}
