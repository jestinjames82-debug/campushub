import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>This page took a different route.</h1>
      <p>Let’s get you back to CampusHub.</p>
      <Link className="button" href="/">
        Go home
      </Link>
    </main>
  );
}
