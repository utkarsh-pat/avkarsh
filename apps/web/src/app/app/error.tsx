"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="setup-shell">
      <section className="setup-card">
        <p className="eyebrow">WORKSPACE UNAVAILABLE</p>
        <h1>We could not load property access.</h1>
        <button className="google-button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
