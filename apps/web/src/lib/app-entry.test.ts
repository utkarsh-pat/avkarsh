import { describe, expect, it } from "vitest";
import { shouldStartOnboarding } from "./app-entry";

describe("authenticated app entry", () => {
  it("starts onboarding for a new user without property access", () => {
    expect(shouldStartOnboarding({
      propertyCount: 0,
      isPlatformAdmin: false,
      propertyAccessFailed: false,
    })).toBe(true);
  });

  it("keeps approved property members in the workspace", () => {
    expect(shouldStartOnboarding({
      propertyCount: 1,
      isPlatformAdmin: false,
      propertyAccessFailed: false,
    })).toBe(false);
  });

  it("keeps platform admins in the workspace entry", () => {
    expect(shouldStartOnboarding({
      propertyCount: 0,
      isPlatformAdmin: true,
      propertyAccessFailed: false,
    })).toBe(false);
  });

  it("keeps the existing error state when property access cannot be checked", () => {
    expect(shouldStartOnboarding({
      propertyCount: 0,
      isPlatformAdmin: false,
      propertyAccessFailed: true,
    })).toBe(false);
  });
});
