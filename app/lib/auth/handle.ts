import { isReservedHandle } from "./reserved-handles";

const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;

export type HandleValidationError =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "reserved"
  | "taken";

export function validateHandle(handle: string): HandleValidationError | null {
  const lower = handle.toLowerCase();
  if (lower.length < 3) return "too_short";
  if (lower.length > 20) return "too_long";
  if (!HANDLE_REGEX.test(lower)) return "invalid_chars";
  if (isReservedHandle(lower)) return "reserved";
  return null;
}

export const HANDLE_ERROR_MESSAGES: Record<HandleValidationError, string> = {
  too_short: "Handle must be at least 3 characters.",
  too_long: "Handle must be 20 characters or fewer.",
  invalid_chars: "Handle may only contain lowercase letters, numbers, and underscores.",
  reserved: "That handle is reserved.",
  taken: "That handle is already taken.",
};
