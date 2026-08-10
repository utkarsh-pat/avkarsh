"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
};

export function PropertyWorkspace({ email, properties, loadError }: PropertyWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(properties[0]?.id ?? "");
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId),
    [properties, selectedId],
  );

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <Link className="brand" href="/">Avkarsh</Link>
        <p className="workspace-user">{email}</p>
      </header>
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
            {properties.map((property) => {
              const isSelected = property.id === selectedId;

              return (
                <li key={property.id}>
                <button
                  aria-pressed={isSelected}
                  className={`property-card${isSelected ? " selected" : ""}`}
                  onClick={() => setSelectedId(property.id)}
                >
                  <span className="index">{property.code}</span>
                  <strong>{property.name}</strong>
                  <span>{property.timezone} · {property.currency_code}</span>
                </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <section className="empty-state" aria-labelledby="empty-title">
            <h2 id="empty-title">No active property access yet.</h2>
            <p>Ask an organization administrator to activate your property membership.</p>
          </section>
        )}

        {selectedProperty ? (
          <section className="selection-panel" aria-live="polite">
            <p className="eyebrow">ACTIVE SELECTION</p>
            <h2>{selectedProperty.name}</h2>
            <p>
              Operational modules will become available here after the M1 authorization resolver
              and property context command flow are complete.
            </p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
