import Link from "next/link";
import { AppShell } from "@/components/app-shell";

type PropertyScope = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  currency_code: string;
};

type PropertyWorkspaceProps = {
  email: string;
  properties: PropertyScope[];
  loadError?: string;
  isPlatformAdmin?: boolean;
};

export function PropertyWorkspace({ email, properties, loadError, isPlatformAdmin }: PropertyWorkspaceProps) {
  return (
    <AppShell email={email} isPlatformAdmin={isPlatformAdmin}>
    <main className="workspace-shell">
      <section className="workspace-content" aria-labelledby="workspace-title">
        <p className="eyebrow">PROPERTY WORKSPACE</p>
        <h1 id="workspace-title">Choose where this shift starts.</h1>
        <p className="workspace-lede">
          Your active memberships determine the properties shown here. A property ID in a URL
          never creates access.
        </p>

        {loadError ? <p className="form-message" role="alert">{loadError}</p> : null}

        {properties.length > 0 ? (
          <ul className="property-grid" aria-label="Available properties">
            {properties.map((property) => (
              <li key={property.id}>
                <Link className="property-card" href={`/app/property/${property.id}`}>
                  <span className="index">{property.code}</span>
                  <strong>{property.name}</strong>
                  <span>{property.timezone} · {property.currency_code}</span>
                  <span className="property-card-action">Open workspace →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <section className="empty-state" aria-labelledby="empty-title">
            <h2 id="empty-title">No active property access yet.</h2>
            <p>Ask an organization administrator to activate your property membership, or submit a new property request.</p>
            <Link className="button primary" href="/register">Register a property</Link>
          </section>
        )}
      </section>
    </main>
    </AppShell>
  );
}
