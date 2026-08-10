const foundations = [
  ["Tenant isolation", "RLS-first organization and property boundaries."],
  ["Operational identity", "Management, staff-device, and guest actors stay explicit."],
  ["Reliable commands", "Idempotency, audit, and outbox are M1 foundations."],
] as const;

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Hotel SaaS home">Hotel SaaS</a>
        <span className="milestone">M1 · Foundation</span>
      </header>
      <section className="hero" id="main">
        <p className="eyebrow">SECURE HOTEL OPERATIONS</p>
        <h1>One calm system for every property and shift.</h1>
        <p className="lede">
          A multilingual, mobile-first hotel platform designed for precise booking,
          guest, folio, staff, and audit workflows.
        </p>
        <div className="actions" aria-label="Project actions">
          <a className="button primary" href="/sign-in">Secure sign-in</a>
          <a className="button secondary" href="#foundation">View foundation</a>
          <a className="button secondary" href="/manifest.webmanifest">PWA manifest</a>
        </div>
      </section>
      <section className="foundation" id="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">IMPLEMENTATION BASELINE</p>
          <h2 id="foundation-title">Built for correctness before complexity.</h2>
        </div>
        <div className="grid">
          {foundations.map(([title, copy], index) => (
            <article className="card" key={title}>
              <span className="index">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
