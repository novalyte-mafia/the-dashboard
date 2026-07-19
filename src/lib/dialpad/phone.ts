/**
 * E.164 phone normalization for outbound dialing.
 * Deliberately conservative: rejects anything it cannot normalize with
 * confidence rather than guessing.
 */

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isE164(value: string): boolean {
  return E164_PATTERN.test(value);
}

/**
 * Normalizes a raw phone value to E.164. US/Canada (NANP) 10-digit numbers
 * are assumed +1; 11-digit numbers starting with 1 are accepted; numbers
 * already in E.164 pass through. Returns null when normalization fails.
 */
export function normalizeToE164(raw: string | null | undefined, defaultCountry: "US" = "US"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already E.164 (allow separators after +)
  if (trimmed.startsWith("+")) {
    const digits = "+" + trimmed.slice(1).replace(/[\s\-().]/g, "");
    return isE164(digits) ? digits : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (defaultCountry === "US") {
    if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits.slice(1))) {
      return `+${digits}`;
    }
  }
  return null;
}

/** Masks a phone number for logs: +1601716…85 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "(none)";
  if (phone.length <= 6) return "***";
  return `${phone.slice(0, 5)}…${phone.slice(-2)}`;
}
