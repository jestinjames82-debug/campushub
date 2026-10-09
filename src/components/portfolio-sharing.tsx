"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Globe, ShieldCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";

export type PublicPortfolio = {
  name: string;
  headline: string;
  summary: string;
  skills: string;
  education: string;
  projects: string;
  links: string;
};
type Publication = { slug: string; published: boolean };

export default function PortfolioSharing({
  demo,
  userId,
  portfolio,
}: {
  demo: boolean;
  userId: string;
  portfolio: PublicPortfolio;
}) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvedSnapshot, setApprovedSnapshot] = useState("");
  const [retry, setRetry] = useState(0);
  // Pick every field explicitly: the private portfolio also has email and phone.
  const snapshot: PublicPortfolio = {
    name: portfolio.name,
    headline: portfolio.headline,
    summary: portfolio.summary,
    skills: portfolio.skills,
    education: portfolio.education,
    projects: portfolio.projects,
    links: portfolio.links,
  };
  const snapshotKey = JSON.stringify(snapshot);
  const approved = approvedSnapshot === snapshotKey;
  useEffect(() => {
    if (demo) return;
    let active = true;
    setLoading(true);
    setError("");
    async function load() {
      try {
        const result = await browserClient()
          .from("public_portfolios")
          .select("slug,published")
          .eq("user_id", userId)
          .maybeSingle();
        if (result.error) throw new Error(result.error.message);
        if (active) setPublication(result.data);
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load sharing settings.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [demo, userId, retry]);

  async function publish() {
    if (demo || busy || !approved) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await browserClient()
        .from("public_portfolios")
        .upsert(
          { user_id: userId, ...snapshot, published: true },
          { onConflict: "user_id" },
        )
        .select("slug,published")
        .single();
      if (result.error) throw new Error(result.error.message);
      setPublication(result.data);
      setApprovedSnapshot("");
      setNotice(
        "Your reviewed snapshot is now public. You can unpublish it here at any time.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not publish your portfolio.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function unpublish() {
    if (demo || busy || !publication) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await browserClient()
        .from("public_portfolios")
        .update({ published: false })
        .eq("user_id", userId)
        .select("slug,published")
        .single();
      if (result.error) throw new Error(result.error.message);
      setPublication(result.data);
      setApprovedSnapshot("");
      setNotice(
        "Portfolio unpublished. New visits to its public link will show page not found.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not unpublish your portfolio.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    if (!publication?.published) return;
    try {
      await navigator.clipboard.writeText(
        new URL(`/portfolio/${publication.slug}`, window.location.origin).href,
      );
      setNotice("Portfolio link copied.");
      setError("");
    } catch {
      setError(
        "Could not copy automatically. Open your public page and copy its address.",
      );
    }
  }

  return (
    <section
      className="feature-card no-print"
      aria-labelledby="portfolio-sharing-heading"
    >
      <div className="actions">
        <h3 id="portfolio-sharing-heading">
          <Globe size={18} /> Share your portfolio
        </h3>
        <span className="muted">
          <ShieldCheck size={14} />{" "}
          {publication?.published ? "Published snapshot" : "Private by default"}
        </span>
      </div>
      <p>
        Publish a separate snapshot for anyone with the link. Your email and
        phone fields are excluded. Anything you write in the sections or links
        below will be public.
      </p>
      <details style={{ margin: "16px 0" }}>
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>
          Preview the exact content to publish
        </summary>
        <div style={{ paddingTop: 14 }}>
          <h3>{snapshot.name}</h3>
          <p>{snapshot.headline}</p>
          {[
            ["Profile", snapshot.summary],
            ["Education", snapshot.education],
            ["Skills", snapshot.skills],
            ["Projects & experience", snapshot.projects],
            ["Links", snapshot.links],
          ]
            .filter(([, content]) => content)
            .map(([heading, content]) => (
              <section key={heading}>
                <h4>{heading}</h4>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {content}
                </p>
              </section>
            ))}
        </div>
      </details>
      {demo ? (
        <p className="notice">
          Public publishing requires a connected student account. This demo
          keeps your portfolio in this browser.
        </p>
      ) : (
        <>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button
                className="text-button"
                disabled={busy || loading}
                onClick={() => setRetry((value) => value + 1)}
              >
                Reload sharing settings
              </button>
            </div>
          )}
          {notice && (
            <p className="notice success" role="status">
              {notice}
            </p>
          )}
          {loading ? (
            <p role="status">Loading sharing settings…</p>
          ) : (
            <>
              {publication?.published && (
                <>
                  <p className="muted">
                    The public page contains your last published snapshot.
                    Saving private edits does not change it. Republishing
                    replaces it with the preview above.
                  </p>
                  <div className="actions">
                    <a
                      className="button secondary"
                      href={`/portfolio/${publication.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} /> View public page
                    </a>
                    <button
                      className="secondary"
                      onClick={() => void copyLink()}
                    >
                      <Copy size={14} /> Copy public link
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void unpublish()}
                    >
                      Unpublish portfolio
                    </button>
                  </div>
                </>
              )}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  margin: "20px 0 14px",
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18, flexShrink: 0 }}
                  checked={approved}
                  onChange={(event) =>
                    setApprovedSnapshot(event.target.checked ? snapshotKey : "")
                  }
                />
                <span>
                  I reviewed the preview and want this snapshot to be publicly
                  accessible.
                </span>
              </label>
              <button
                disabled={busy || !approved}
                onClick={() => void publish()}
              >
                {busy
                  ? "Saving sharing settings…"
                  : publication?.published
                    ? "Publish updated snapshot"
                    : "Publish portfolio"}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
