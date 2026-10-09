"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Something interrupted your workspace.</h1>
      <p>Your saved data is safe. Please try again.</p>
      <button onClick={reset}>Try again</button>
      <a href="/">Back to home</a>
    </main>
  );
}
