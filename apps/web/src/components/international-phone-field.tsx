"use client";

import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import {
  buildE164Phone,
  defaultPhoneCountry,
  getPhoneCountry,
  isPossiblePhone,
  maxInternationalPhoneDigits,
  phoneCountries,
  sanitizeNationalPhone,
} from "@/lib/phone";

type InternationalPhoneFieldProps = {
  disabled?: boolean;
  label: string;
  name: string;
  onValueChange: (value: InternationalPhoneValue) => void;
  optional?: boolean;
  value: InternationalPhoneValue;
};

export type InternationalPhoneValue = {
  countryIso: CountryCode;
  nationalNumber: string;
};

export const emptyInternationalPhone: InternationalPhoneValue = {
  countryIso: defaultPhoneCountry,
  nationalNumber: "",
};

function CountryFlag({ country }: { country: ReturnType<typeof getPhoneCountry> }) {
  return (
    <span className="country-flag" aria-hidden="true">
      <span>{country.iso}</span>
      <Image
        src={country.flagUrl}
        alt=""
        width={40}
        height={30}
        loading="lazy"
        unoptimized
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
    </span>
  );
}

export function InternationalPhoneField({ disabled = false, label, name, onValueChange, optional = false, value }: InternationalPhoneFieldProps) {
  const [countrySearch, setCountrySearch] = useState("");
  const [touched, setTouched] = useState(false);
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const country = getPhoneCountry(value.countryIso);
  const valid = isPossiblePhone(value.countryIso, value.nationalNumber);
  const canonicalPhone = valid ? buildE164Phone(value.countryIso, value.nationalNumber) : "";
  const error = touched && value.nationalNumber && !valid ? `Enter a valid ${country.name} number.` : "";
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase().replace(/^\+/, "");
    if (!query) return phoneCountries;
    return phoneCountries.filter((option) => option.name.toLowerCase().includes(query)
      || option.iso.toLowerCase().includes(query)
      || option.dialCode.includes(query));
  }, [countrySearch]);

  useEffect(() => {
    const validEmptyOptional = optional && !value.nationalNumber;
    inputRef.current?.setCustomValidity(valid || validEmptyOptional ? "" : `Enter a valid ${country.name} number.`);
  }, [country.name, optional, valid, value.nationalNumber]);

  return (
    <label className="international-phone-label">
      <span>{label} {optional ? <small>optional</small> : null}</span>
      <input type="hidden" name={name} value={canonicalPhone} />
      <div className={`international-phone-control${error ? " invalid" : ""}${disabled ? " disabled" : ""}`}>
        <details className="country-picker" ref={pickerRef}>
          <summary aria-disabled={disabled} onClick={(event) => { if (disabled) event.preventDefault(); }} aria-label={`Country code: ${country.name} +${country.dialCode}`}>
            <CountryFlag country={country} />
            <span>+{country.dialCode}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="country-menu">
            <div className="country-search">
              <Search size={16} aria-hidden="true" />
              <input value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} placeholder="Search country or code" aria-label="Search countries" />
            </div>
            <div className="country-options">
              {filteredCountries.map((option) => (
                <button
                  type="button"
                  key={option.iso}
                  className={option.iso === value.countryIso ? "selected" : ""}
                  onClick={() => {
                    onValueChange({ ...value, countryIso: option.iso });
                    setTouched(Boolean(value.nationalNumber));
                    setCountrySearch("");
                    pickerRef.current?.removeAttribute("open");
                  }}
                >
                  <CountryFlag country={option} />
                  <span>{option.name}</span>
                  <small>+{option.dialCode}</small>
                </button>
              ))}
              {filteredCountries.length === 0 ? <p>No countries found</p> : null}
            </div>
          </div>
        </details>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete={name === "contactPhone" ? "tel-national" : "off"}
          placeholder="9876543210"
          value={value.nationalNumber}
          disabled={disabled}
          required={!optional}
          maxLength={maxInternationalPhoneDigits}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => onValueChange({ ...value, nationalNumber: sanitizeNationalPhone(event.target.value) })}
          onInvalid={() => {
            setTouched(true);
          }}
        />
      </div>
      {error ? <small className="phone-field-error" id={`${name}-error`}>{error}</small> : null}
    </label>
  );
}
