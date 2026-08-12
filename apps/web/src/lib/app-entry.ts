type AppEntryContext = {
  propertyCount: number;
  isPlatformAdmin: boolean;
  propertyAccessFailed: boolean;
};

export function shouldStartOnboarding({
  propertyCount,
  isPlatformAdmin,
  propertyAccessFailed,
}: AppEntryContext) {
  return !propertyAccessFailed && propertyCount === 0 && !isPlatformAdmin;
}
