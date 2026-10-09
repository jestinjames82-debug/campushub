import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, ArrowUpRight } from "lucide-react";
import { serverClient } from "@/lib/supabase/server";
import { resourceUrl } from "@/lib/resources";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Student portfolio · CampusHub",
  robots: { index: false, follow: false },
};

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slug,
    )
  )
    notFound();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    notFound();
  const client = await serverClient();
  const { data, error } = await client.rpc("get_public_portfolio", {
    portfolio_slug: slug,
  });
  if (error)
    throw new Error(
      "This portfolio could not be loaded. Please try again later.",
    );
  const portfolio = data?.[0] as
    | {
        name: string;
        headline: string;
        summary: string;
        skills: string;
        education: string;
        projects: string;
        links: string;
      }
    | undefined;
  if (!portfolio) notFound();
  const links = portfolio.links.split("\n").flatMap((link) => {
    try {
      return [resourceUrl(link)];
    } catch {
      return [];
    }
  });
  return (
    <main
      style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 64px" }}
    >
      <nav
        aria-label="Portfolio navigation"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 48,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 750,
          }}
        >
          <GraduationCap size={24} /> CampusHub
        </Link>
        <span className="muted" style={{ fontSize: 12 }}>
          Student portfolio
        </span>
      </nav>
      <article
        className="feature-card"
        style={{ padding: "clamp(24px, 5vw, 56px)" }}
      >
        <header
          style={{
            borderBottom: "1px solid #eeedf3",
            paddingBottom: 26,
            marginBottom: 28,
          }}
        >
          <span className="eyebrow">A LITTLE ABOUT ME</span>
          <h1
            style={{
              fontSize: "clamp(30px, 6vw, 46px)",
              lineHeight: 1.18,
              margin: "12px 0",
            }}
          >
            {portfolio.name}
          </h1>
          <p style={{ fontSize: 19 }}>{portfolio.headline}</p>
        </header>
        {[
          ["Profile", portfolio.summary],
          ["Education", portfolio.education],
          ["Skills", portfolio.skills],
          ["Projects & experience", portfolio.projects],
        ]
          .filter(([, content]) => content)
          .map(([heading, content]) => (
            <section key={heading} style={{ marginBottom: 30 }}>
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>{heading}</h2>
              <p
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  lineHeight: 1.75,
                }}
              >
                {content}
              </p>
            </section>
          ))}
        {links.length > 0 && (
          <section>
            <h2 style={{ fontSize: 20 }}>Find my work</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {[...new Set(links)].map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {link} <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </section>
        )}
      </article>
      <p className="muted" style={{ marginTop: 24, fontSize: 12 }}>
        Published by the portfolio owner. CampusHub does not verify student
        qualifications or external links.
      </p>
    </main>
  );
}
