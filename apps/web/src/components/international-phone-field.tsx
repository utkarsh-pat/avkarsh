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
  label: string;
  name: string;
  optional?: boolean;
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

export function InternationalPhoneField({ label, name, optional = false }: InternationalPhoneFieldProps) {
  const [countryIso, setCountryIso] = useState<CountryCode>(defaultPhoneCountry);
  const [nationalNumber, setNationalNumber] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [touched, setTouched] = useState(false);
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const country = getPhoneCountry(countryIso);
  const valid = isPossiblePhone(countryIso, nationalNumber);
  const canonicalPhone = valid ? buildE164Phone(countryIso, nationalNumber) : "";
  const error = touched && nationalNumber && !valid ? `Enter a valid ${country.name} number.` : "";
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase().replace(/^\+/, "");
    if (!query) return phoneCountries;
    return phoneCountries.filter((option) => option.name.toLowerCase().includes(query)
      || option.iso.toLowerCase().includes(query)
      || option.dialCode.includes(query));
  }, [countrySearch]);

  useEffect(() => {
    const validEmptyOptional = optional && !nationalNumber;
    inputRef.current?.setCustomValidity(valid || validEmptyOptional ? "" : `Enter a valid ${country.name} number.`);
  }, [country.name, nationalNumber, optional, valid]);

  return (
    <label className="international-phone-label">
      <span>{label} {optional ? <small>optional</small> : null}</span>
      <input type="hidden" name={name} value={canonicalPhone} />
      <div className={`international-phone-control${error ? " invalid" : ""}`}>
        <details className="country-picker" ref={pickerRef}>
          <summary aria-label={`Country code: ${country.name} +${country.dialCode}`}>
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
                  className={option.iso === countryIso ? "selected" : ""}
                  onClick={() => {
                    setCountryIso(option.iso);
                    setTouched(Boolean(nationalNumber));
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
          value={nationalNumber}
          required={!optional}
          maxLength={maxInternationalPhoneDigits}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          onBlur={() => setTouched(true)}
          onChange={(event) => setNationalNumber(sanitizeNationalPhone(event.target.value))}
          onInvalid={() => {
            setTouched(true);
          }}
        />
      </div>
      {error ? <small className="phone-field-error" id={`${name}-error`}>{error}</small> : null}
    </label>
  );
}
