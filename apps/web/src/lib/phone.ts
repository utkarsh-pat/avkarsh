import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";

export const defaultPhoneCountry: CountryCode = "IN";
export const maxInternationalPhoneDigits = 15;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export type PhoneCountry = {
  iso: CountryCode;
  name: string;
  dialCode: string;
  flagUrl: string;
};

export const phoneCountries: PhoneCountry[] = getCountries()
  .map((iso) => ({
    iso,
    name: regionNames.of(iso) ?? iso,
    dialCode: getCountryCallingCode(iso),
    flagUrl: `https://flagcdn.com/w40/${iso.toLowerCase()}.png`,
  }))
  .sort((left, right) => {
    if (left.iso === defaultPhoneCountry) return -1;
    if (right.iso === defaultPhoneCountry) return 1;
    return left.name.localeCompare(right.name);
  });

export function getPhoneCountry(iso: CountryCode) {
  return phoneCountries.find((country) => country.iso === iso) ?? phoneCountries[0]!;
}

export function sanitizeNationalPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, maxInternationalPhoneDigits);
}

export function buildE164Phone(country: CountryCode, nationalNumber: string) {
  const digits = sanitizeNationalPhone(nationalNumber);
  if (!digits) return "";
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.isPossible() ? parsed.number : "";
}

export function isPossiblePhone(country: CountryCode, nationalNumber: string) {
  const digits = sanitizeNationalPhone(nationalNumber);
  return Boolean(
    digits
    && validatePhoneNumberLength(digits, country) === undefined
    && parsePhoneNumberFromString(digits, country)?.isPossible(),
  );
}
