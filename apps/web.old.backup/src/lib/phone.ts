/** Normalize phone for API (digits with optional leading +). */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  // Iran: 09xxxxxxxxx → +989xxxxxxxxx
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+98${digits.slice(1)}`;
  }
  if (digits.startsWith("98") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `+98${digits}`;
  }
  // US: 10 digits
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return digits.length > 0 ? `+${digits}` : trimmed;
}

/** Display-friendly format for success screen */
export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone);
  if (n.startsWith("+98") && n.length >= 12) {
    return `0${n.slice(3)}`;
  }
  return n;
}
