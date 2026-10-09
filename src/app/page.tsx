import Link from "next/link";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
export default function Home() {
  return (
    <main className="landing">
      <nav>
        <Link className="brand" href="/">
          <span className="logo">
            <GraduationCap />
          </span>
          CampusHub<span className="brand-dot">.</span>
        </Link>
        <div className="landing-actions">
          <ThemeToggle compact />
          <Link className="button secondary" href="/auth">
            Sign in <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="landing-hero">
        <h1>
          Keep your semester
          <br />
          in one place.
        </h1>
        <p>
          Plan classes, track progress, save study material and prepare for what
          comes next, with a workspace that adapts to your college.
        </p>
        <div className="actions">
          <Link className="button" href="/auth?mode=signup">
            Create your workspace <ArrowUpRight size={18} />
          </Link>
          <Link className="button secondary" href="/demo/dashboard">
            Explore the demo
          </Link>
        </div>
        <small>Made for students at any college in India.</small>
        <div className="landing-cards">
          <article>
            <strong>01</strong>
            <h3>Academic basics</h3>
            <p>Terms, subjects and profile details stay together.</p>
          </article>
          <article>
            <strong>02</strong>
            <h3>Daily study work</h3>
            <p>Deadlines, notes, attendance and goals are easy to find.</p>
          </article>
          <article>
            <strong>03</strong>
            <h3>Private by default</h3>
            <p>You choose what to share with a group or public portfolio.</p>
          </article>
        </div>
      </section>
      <footer>CampusHub · Make room for what matters.</footer>
    </main>
  );
}
