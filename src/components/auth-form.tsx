"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GraduationCap, ArrowRight } from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";
import {
  SIGNUP_COOLDOWN_KEY,
  SIGNUP_COOLDOWN_MS,
  acquireSignupRequestLock,
  authMessage,
  isRateLimitError,
  readStoredTimestamp,
  releaseSignupRequestLock,
  signupRedirectUrl,
  writeStoredTimestamp,
} from "@/lib/supabase/auth";
import ThemeToggle from "./theme-toggle";

export default function AuthForm() {
  const params = useSearchParams(),
    router = useRouter();
  const [signup, setSignup] = useState(params.get("mode") === "signup"),
    [busy, setBusy] = useState(false),
    [signupCooldownUntil, setSignupCooldownUntil] = useState(0),
    [signupCooldownSeconds, setSignupCooldownSeconds] = useState(0),
    [message, setMessage] = useState(
      params.has("error")
        ? "Confirmation link expired or invalid. Please sign in or request another link."
        : "",
    );
  const submitLock = useRef(false);

  useEffect(() => {
    const stored = readStoredTimestamp(SIGNUP_COOLDOWN_KEY);
    if (stored > Date.now()) setSignupCooldownUntil(stored);
  }, []);

  useEffect(() => {
    if (!signupCooldownUntil) return;
    const tick = () => {
      const remaining = Math.max(0, signupCooldownUntil - Date.now());
      setSignupCooldownSeconds(Math.ceil(remaining / 1000));
      if (!remaining) {
        setSignupCooldownUntil(0);
        writeStoredTimestamp(SIGNUP_COOLDOWN_KEY, 0);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [signupCooldownUntil]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    const form = new FormData(event.currentTarget);
    let requestLock = 0;
    try {
      const storedCooldown = readStoredTimestamp(SIGNUP_COOLDOWN_KEY);
      const cooldownUntil = Math.max(signupCooldownUntil, storedCooldown);
      if (signup && cooldownUntil > Date.now()) {
        setSignupCooldownUntil(cooldownUntil);
        setMessage(
          `Please wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)} seconds before requesting another confirmation email.`,
        );
        return;
      }
      const lock = signup ? acquireSignupRequestLock() : 1;
      if (signup && !lock) {
        setMessage(
          "A signup request is already being processed in another tab. Wait for it to finish before trying again.",
        );
        return;
      }
      requestLock = lock;
      setBusy(true);
      setMessage("");
      const client = browserClient();
      const email = String(form.get("email")).trim(),
        password = String(form.get("password"));
      const result = signup
        ? await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: signupRedirectUrl(location.origin) },
          })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup && !result.data.session) {
        const cooldown = Date.now() + SIGNUP_COOLDOWN_MS;
        setSignupCooldownUntil(cooldown);
        setSignupCooldownSeconds(Math.ceil(SIGNUP_COOLDOWN_MS / 1000));
        writeStoredTimestamp(SIGNUP_COOLDOWN_KEY, cooldown);
        setMessage(
          "Check your email to confirm your account, then return here to sign in. If it does not arrive, check spam and wait before requesting another email.",
        );
      } else {
        router.replace("/app/dashboard");
        router.refresh();
      }
    } catch (error) {
      if (signup && isRateLimitError(error)) {
        const cooldown = Date.now() + SIGNUP_COOLDOWN_MS;
        setSignupCooldownUntil(cooldown);
        setSignupCooldownSeconds(Math.ceil(SIGNUP_COOLDOWN_MS / 1000));
        writeStoredTimestamp(SIGNUP_COOLDOWN_KEY, cooldown);
      }
      setMessage(authMessage(error, signup));
    } finally {
      setBusy(false);
      releaseSignupRequestLock(requestLock);
      submitLock.current = false;
    }
  }
  return (
    <main className="auth-page">
      <aside>
        <Link href="/" className="brand">
          <span className="logo">
            <GraduationCap />
          </span>
          CampusHub.
        </Link>
        <div>
          <h1>
            Your semester.
            <br />A little more
            <br />
            organised.
          </h1>
          <p>
            One clear place for the work, plans and decisions that keep college
            moving.
          </p>
        </div>
        <small>One workspace. Any college. All yours.</small>
      </aside>
      <section>
        <div className="auth-toolbar">
          <ThemeToggle compact />
        </div>
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO CAMPUSHUB</span>
          <h2>
            {signup ? "Make yourself at home." : "Good to have you back."}
          </h2>
          <p>
            {signup
              ? "Create your personal academic workspace."
              : "Sign in and pick up where you left off."}
          </p>
          {!configured && (
            <div className="notice">
              Student accounts need a connected Supabase project. The
              interactive demo is ready to explore.
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </label>
            <button
              disabled={
                busy ||
                !configured ||
                (signup && signupCooldownUntil > Date.now())
              }
            >
              {busy
                ? "Please wait…"
                : signup && signupCooldownSeconds > 0
                  ? `Try again in ${signupCooldownSeconds}s`
                  : signup
                    ? "Create account"
                    : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <p>
            {signup ? "Already have an account?" : "New here?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setSignup(!signup);
                setMessage("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <Link className="demo-link" href="/demo/dashboard">
            Take a look around first →
          </Link>
        </div>
      </section>
    </main>
  );
}
