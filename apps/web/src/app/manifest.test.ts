import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA manifest", () => {
  it("uses the web app as the single installable product", () => {
    const result = manifest();

    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
    expect(result.name).toBe("Hotel SaaS");
  });

  it("provides standard and maskable install icons", () => {
    const purposes = manifest().icons?.map((icon) => icon.purpose);

    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
  });
});

