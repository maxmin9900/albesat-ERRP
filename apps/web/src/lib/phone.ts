import { z } from "zod";

/** 8-digit Oman mobile: starts with 7 or 9 */
const OMAN_NATIONAL = /^[79]\d{7}$/;

/** Parse and normalize to E.164 (+968XXXXXXXX). Returns null if invalid. */
export function parseOmanPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 8 && OMAN_NATIONAL.test(digits)) {
    return `+968${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("968") && OMAN_NATIONAL.test(digits.slice(3))) {
    return `+968${digits.slice(3)}`;
  }
  if (digits.length === 14 && digits.startsWith("00968") && OMAN_NATIONAL.test(digits.slice(4))) {
    return `+968${digits.slice(4)}`;
  }

  return null;
}

export function isValidOmanPhone(input: string): boolean {
  return parseOmanPhone(input) !== null;
}

/** Restrict typing to plausible Oman phone characters and max length. */
export function sanitizeOmanPhoneInput(raw: string): string {
  const trimmed = raw.trimStart();
  const hasPlus = trimmed.startsWith("+");
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00968")) {
    digits = digits.slice(2);
  }

  if (hasPlus || digits.startsWith("968")) {
    if (digits.startsWith("968")) {
      digits = digits.slice(0, 11);
    } else {
      digits = digits.slice(0, 11);
    }
    return hasPlus ? `+${digits}` : digits;
  }

  return digits.slice(0, 8);
}

export const OMAN_PHONE_ERROR =
  "Enter a valid Oman mobile number (8 digits starting with 7 or 9, e.g. 91234567)";

export const omanPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine(isValidOmanPhone, { message: OMAN_PHONE_ERROR })
  .transform((val) => parseOmanPhone(val)!);

/** 10-digit Iran mobile national number (9XXXXXXXXX). */
const IRAN_NATIONAL = /^9\d{9}$/;

/** Parse and normalize to E.164 (+989XXXXXXXXX). Returns null if invalid. */
export function parseIranPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("09")) {
    const national = digits.slice(1);
    return IRAN_NATIONAL.test(national) ? `+98${national}` : null;
  }
  if (digits.length === 10 && IRAN_NATIONAL.test(digits)) {
    return `+98${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("98") && IRAN_NATIONAL.test(digits.slice(2))) {
    return `+98${digits.slice(2)}`;
  }
  if (digits.length === 14 && digits.startsWith("0098") && IRAN_NATIONAL.test(digits.slice(4))) {
    return `+98${digits.slice(4)}`;
  }

  return null;
}

export function isValidIranPhone(input: string): boolean {
  return parseIranPhone(input) !== null;
}

export function isValidLoginPhone(input: string): boolean {
  return isValidOmanPhone(input) || isValidIranPhone(input);
}

/** Limit phone typing — max 15 digits (E.164). */
export function sanitizePhoneInput(raw: string): string {
  const trimmed = raw.trimStart();
  const hasPlus = trimmed.startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  if (!digits) return hasPlus ? "+" : "";
  return hasPlus ? `+${digits}` : digits;
}

export const LOGIN_PHONE_ERROR =
  "Enter a valid mobile number (Iran: 09XXXXXXXXX or Oman: 9XXXXXXX)";

export const loginPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine(isValidLoginPhone, { message: LOGIN_PHONE_ERROR });

/** Normalize login phone to E.164. Call only after validation. */
export function normalizeLoginPhone(input: string): string {
  return parseOmanPhone(input) ?? parseIranPhone(input)!;
}

/** Normalize phone for API (digits with optional leading +). Used by staff auth (Iran). */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+98${digits.slice(1)}`;
  }
  if (digits.startsWith("98") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `+98${digits}`;
  }
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
  const oman = parseOmanPhone(phone);
  if (oman) {
    const national = oman.slice(4);
    return `+968 ${national.slice(0, 4)} ${national.slice(4)}`;
  }
  const n = normalizePhone(phone);
  if (n.startsWith("+98") && n.length >= 12) {
    return `0${n.slice(3)}`;
  }
  return n;
}

/* --------------------------------------------------------------------------
 * Customer phones — orders and invoices come from Oman and Iran, so both are
 * accepted. Staff and partner numbers stay Oman-only.
 * ----------------------------------------------------------------------- */

/** Parse a customer phone from either supported country. Null if invalid. */
export function parseCustomerPhone(input: string): string | null {
  return parseOmanPhone(input) ?? parseIranPhone(input);
}

export function isValidCustomerPhone(input: string): boolean {
  return parseCustomerPhone(input) !== null;
}

/** Allow either country's digits while typing (E.164 caps at 15). */
export function sanitizeCustomerPhoneInput(raw: string): string {
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  if (!digits) return hasPlus ? "+" : "";
  return hasPlus ? `+${digits}` : digits;
}

export const CUSTOMER_PHONE_ERROR =
  "Enter a valid Oman (9XXXXXXX) or Iran (09XXXXXXXXX) mobile number";

export const customerPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine(isValidCustomerPhone, { message: CUSTOMER_PHONE_ERROR })
  .transform((val) => parseCustomerPhone(val)!);
