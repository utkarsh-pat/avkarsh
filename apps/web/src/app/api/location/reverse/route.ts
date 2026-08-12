import { NextResponse } from "next/server";
import { z } from "zod";
import tzlookup from "tz-lookup";

const coordinateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

type AddressResult = {
  addressLine: string;
  city: string;
  stateRegion: string;
  countryCode: string;
  displayName: string;
};

async function reverseWithGoogle(lat: number, lng: number, apiKey: string): Promise<AddressResult | null> {
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json() as { results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; short_name: string; types: string[] }> }> };
  const result = payload.results?.[0];
  if (!result) return null;
  const component = (type: string) => result.address_components?.find((item) => item.types.includes(type));
  return {
    addressLine: result.formatted_address ?? "Pinned property location",
    city: component("locality")?.long_name ?? component("administrative_area_level_2")?.long_name ?? "Nearby city",
    stateRegion: component("administrative_area_level_1")?.long_name ?? "Nearby region",
    countryCode: component("country")?.short_name?.toUpperCase() ?? "IN",
    displayName: result.formatted_address ?? "Pinned property location",
  };
}

async function reverseWithOpenStreetMap(lat: number, lng: number): Promise<AddressResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Avkarsh/1.0 (https://avkarsh.vercel.app)" },
  });
  if (!response.ok) return null;
  const payload = await response.json() as { display_name?: string; address?: Record<string, string> };
  const address = payload.address ?? {};
  const displayName = payload.display_name ?? "Pinned property location";
  return {
    addressLine: displayName,
    city: address.city ?? address.town ?? address.village ?? address.county ?? "Nearby city",
    stateRegion: address.state ?? address.region ?? "Nearby region",
    countryCode: address.country_code?.toUpperCase() ?? "IN",
    displayName,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = coordinateSchema.safeParse({ lat: url.searchParams.get("lat"), lng: url.searchParams.get("lng") });
  if (!parsed.success) return NextResponse.json({ message: "Invalid map coordinates." }, { status: 400 });
  const { lat, lng } = parsed.data;
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  const address = (googleKey ? await reverseWithGoogle(lat, lng, googleKey) : null)
    ?? await reverseWithOpenStreetMap(lat, lng);
  if (!address) return NextResponse.json({ message: "Address could not be resolved for this pin." }, { status: 502 });
  return NextResponse.json({ ...address, timezone: tzlookup(lat, lng) }, { headers: { "Cache-Control": "private, max-age=300" } });
}
