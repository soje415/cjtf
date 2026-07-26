import { createHash, randomInt } from 'crypto'

export const OTP_TTL_MS = 10 * 60 * 1000          // code valid for 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000   // 60s between sends
export const OTP_MAX_ATTEMPTS = 5                 // wrong-guess limit per code

/** 6-digit numeric code, cryptographically random. */
export function generateOtp(): string {
  return String(randomInt(100000, 1000000))
}

/**
 * Hash the code before storing. Peppered with the service-role key (a
 * server-only secret) and salted with the user id, so the stored value is
 * useless if the row ever leaks. Short-lived, so SHA-256 is sufficient.
 */
export function hashOtp(code: string, userId: string): string {
  return createHash('sha256')
    .update(`${userId}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`)
    .digest('hex')
}
