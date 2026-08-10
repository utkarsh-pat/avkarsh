const foundations = [
  ["Secure by design", "RLS-first organization and property boundaries."],
  ["Ready for every shift", "Clear staff, guest, and device identities."],
  ["Built for accuracy", "Idempotency, audit, and outbox foundations."],
] as const;

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Avkarsh home">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>Avkarsh</span>
        </a>
        <nav className="topbar-actions" aria-label="Primary navigation">
          <a href="#foundation">How it works</a>
          <a className="button primary compact" href="/sign-in">Sign in</a>
        </nav>
      </header>

      <section className="hero" id="main">
        <div className="hero-copy">
          <p className="eyebrow">HOTEL OPERATIONS, SIMPLIFIED</p>
          <h1>Run every property and every shift with confidence.</h1>
          <p className="lede">
            A secure, multilingual hotel workspace for bookings, guests, folios,
            staff, and audit workflows.
          </p>
          <div className="actions" aria-label="Project actions">
            <a className="button primary" href="/sign-in">Get started</a>
            <a className="button secondary" href="#foundation">Explore features</a>
          </div>
        </div>
        <aside className="hero-panel" aria-label="Hotel operations overview">
          <p className="panel-label">TODAY AT A GLANCE</p>
          <div className="panel-stat"><strong>24</strong><span>arrivals expected</span></div>
          <div className="panel-row"><span>Rooms ready</span><strong>18 / 24</strong></div>
          <div className="panel-row"><span>Open folios</span><strong>6</strong></div>
          <div className="panel-status"><span aria-hidden="true" />All systems operational</div>
        </aside>
      </section>

      <section className="trust-strip" aria-label="Product benefits">
        <span>Responsive web app</span>
        <span>Installable PWA</span>
        <span>Multi-property ready</span>
        <span>Role-based access</span>
      </section>

      <section className="foundation" id="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <p className="eyebrow">A PRACTICAL FOUNDATION</p>
          <h2 id="foundation-title">Everything your team needs to stay in sync.</h2>
          <p>Use a familiar interface that keeps operational details easy to find on desktop and mobile.</p>
        </div>
        <div className="grid">
          {foundations.map(([title, copy], index) => (
            <article className="card" key={title}>
              <span className="index" aria-hidden="true">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
