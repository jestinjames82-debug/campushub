export const SIGNUP_COOLDOWN_MS = 60_000;
export const SIGNUP_REQUEST_LOCK_MS = 15_000;
export const SIGNUP_COOLDOWN_KEY = "campushub-signup-cooldown";
export const SIGNUP_REQUEST_LOCK_KEY = "campushub-signup-request-lock";

export function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

export function isRateLimitError(error: unknown) {
  const text = errorText(error);
  return /rate.?limit|too many|security purposes|email.*limit|\b429\b/i.test(
    text,
  );
}

export function isEmailNotConfirmedError(error: unknown) {
  return /email.*not confirmed|email_not_confirmed/i.test(errorText(error));
}

export function isAlreadyRegisteredError(error: unknown) {
  return /already registered|already exists|user already/i.test(
    errorText(error),
  );
}

export function authMessage(error: unknown, signup: boolean) {
  if (isRateLimitError(error)) {
    return signup
      ? "Email confirmation is temporarily limited by Supabase. Wait a minute before trying again. If you already created an account, use Sign in."
      : "Too many sign-in attempts were made. Wait a minute, then try again.";
  }
  if (isAlreadyRegisteredError(error)) {
    return "This email already has an account. Switch to Sign in instead.";
  }
  if (isEmailNotConfirmedError(error)) {
    return "Your email is not confirmed yet. Open the latest confirmation email, then sign in.";
  }
  if (/invalid login credentials|invalid_credentials/i.test(errorText(error))) {
    return "The email or password is incorrect. Check both and try again.";
  }
  if (/fetch failed|network|failed to fetch/i.test(errorText(error))) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }
  return (
    errorText(error) ||
    (signup
      ? "Unable to create your account. Try again."
      : "Unable to sign in. Try again.")
  );
}

export function readStoredTimestamp(key: string) {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function writeStoredTimestamp(key: string, value: number) {
  if (typeof window === "undefined") return;
  try {
    if (value > 0) window.localStorage.setItem(key, String(value));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing; the in-memory guard still applies.
  }
}

export function acquireSignupRequestLock(now = Date.now()) {
  const existing = readStoredTimestamp(SIGNUP_REQUEST_LOCK_KEY);
  if (existing > now) return 0;
  const expires = now + SIGNUP_REQUEST_LOCK_MS;
  writeStoredTimestamp(SIGNUP_REQUEST_LOCK_KEY, expires);
  return expires;
}

export function releaseSignupRequestLock(expires: number) {
  if (expires && readStoredTimestamp(SIGNUP_REQUEST_LOCK_KEY) === expires)
    writeStoredTimestamp(SIGNUP_REQUEST_LOCK_KEY, 0);
}

export function signupRedirectUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}
