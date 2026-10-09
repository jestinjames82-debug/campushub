"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, ArrowRight } from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";
import ThemeToggle from "./theme-toggle";
export default function AuthForm() {
  const params = useSearchParams(),
    router = useRouter();
  const [signup, setSignup] = useState(params.get("mode") === "signup"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      params.has("error")
        ? "Confirmation link expired or invalid. Please sign in or request another link."
        : "",
    );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const client = browserClient();
      const email = String(form.get("email")).trim(),
        password = String(form.get("password"));
      const result = signup
        ? await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${location.origin}/auth/callback` },
          })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup && !result.data.session)
        setMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
      else {
        router.replace("/app/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Try again.",
      );
    } finally {
      setBusy(false);
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
            <button disabled={busy || !configured}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
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
