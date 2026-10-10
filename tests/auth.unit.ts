import test from "node:test";
import assert from "node:assert/strict";
import {
  authMessage,
  isRateLimitError,
  signupRedirectUrl,
} from "../src/lib/supabase/auth.ts";

test("auth errors identify Supabase email limits and give safe guidance", () => {
  assert.equal(isRateLimitError(new Error("email rate limit exceeded")), true);
  assert.match(
    authMessage(new Error("email rate limit exceeded"), true),
    /Supabase/,
  );
  assert.match(
    authMessage(new Error("Invalid login credentials"), false),
    /email or password is incorrect/i,
  );
  assert.match(
    authMessage(new Error("Email not confirmed"), false),
    /not confirmed/i,
  );
});

test("confirmation redirects stay on the current trusted origin", () => {
  assert.equal(
    signupRedirectUrl("https://campushub-drab.vercel.app/"),
    "https://campushub-drab.vercel.app/auth/callback",
  );
  assert.equal(
    signupRedirectUrl("http://localhost:3000"),
    "http://localhost:3000/auth/callback",
  );
});
