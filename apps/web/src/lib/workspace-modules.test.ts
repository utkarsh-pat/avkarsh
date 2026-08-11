import { describe, expect, it } from "vitest";
import { onboardingPermissions } from "./onboarding";
import { workspaceModules } from "./workspace-modules";

describe("permission-aware workspace catalogue", () => {
  it("keeps workspace permission keys unique", () => {
    const keys = workspaceModules.map(({ permission }) => permission);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers every permission exposed by onboarding controls", () => {
    const approvedKeys = onboardingPermissions.map(([key]) => key).toSorted();
    const workspaceKeys = workspaceModules.map(({ permission }) => permission).toSorted();
    expect(workspaceKeys).toEqual(approvedKeys);
  });
});
