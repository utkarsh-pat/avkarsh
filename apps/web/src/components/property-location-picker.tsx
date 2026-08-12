"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { divIcon, type LatLngExpression } from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";

export type PropertyLocation = {
  lat: number;
  lng: number;
  addressLine: string;
  city: string;
  stateRegion: string;
  countryCode: string;
  timezone: string;
};

type Props = { value: PropertyLocation | null; onChange: (value: PropertyLocation) => void };

const fallbackCenter: LatLngExpression = [20.5937, 78.9629];
const pinIcon = divIcon({
  className: "property-map-pin",
  html: `<svg aria-hidden="true" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg"><path d="M24 2C11.85 2 2 11.85 2 24c0 16.5 22 34 22 34s22-17.5 22-34C46 11.85 36.15 2 24 2Z" fill="#173b7a" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="13" fill="#fff"/><path d="M17 31V18.5c0-.83.67-1.5 1.5-1.5h11c.83 0 1.5.67 1.5 1.5V31M15 31h18M21 21h2m4 0h2m-8 4h2m4 0h2m-6 6v-3h4v3" fill="none" stroke="#173b7a" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>`,
  iconSize: [48, 60],
  iconAnchor: [24, 57],
});

function MapInteraction({ position, accuracy, onPick }: { position: [number, number] | null; accuracy: number; onPick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 17, { duration: .7 }); }, [map, position]);
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return <>{position ? <><Marker position={position} icon={pinIcon} draggable eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); onPick(point.lat, point.lng); } }} />{accuracy > 0 ? <Circle center={position} radius={accuracy} pathOptions={{ color: "#2457a6", fillOpacity: .08, weight: 1 }} /> : null}</> : null}</>;
}

export default function PropertyLocationPicker({ value, onChange }: Props) {
  const [status, setStatus] = useState("Use current location, then adjust the pin to the property entrance.");
  const [accuracy, setAccuracy] = useState(0);
  const [locating, setLocating] = useState(false);
  const latitude = value?.lat;
  const longitude = value?.lng;
  const position = useMemo(() => latitude !== undefined && longitude !== undefined ? [latitude, longitude] as [number, number] : null, [latitude, longitude]);

  const resolvePin = useCallback(async (lat: number, lng: number) => {
    setStatus("Fetching address for this pin…");
    try {
      const response = await fetch(`/api/location/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
      const address = await response.json() as Omit<PropertyLocation, "lat" | "lng"> & { message?: string };
      if (!response.ok) throw new Error(address.message);
      onChange({ lat, lng, addressLine: address.addressLine, city: address.city, stateRegion: address.stateRegion, countryCode: address.countryCode, timezone: address.timezone });
      setStatus("Location confirmed. Drag or click nearby to fine-tune the pin.");
    } catch {
      setStatus("We could not fetch this address. Move the pin slightly or try current location again.");
    }
  }, [onChange]);

  function useCurrentLocation() {
    if (!navigator.geolocation) { setStatus("Location is not supported on this device."); return; }
    setLocating(true);
    setStatus("Finding your current location…");
    navigator.geolocation.getCurrentPosition(
      (result) => { setAccuracy(result.coords.accuracy); setLocating(false); void resolvePin(result.coords.latitude, result.coords.longitude); },
      () => { setLocating(false); setStatus("Location permission was blocked. Enable it in browser settings and try again."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  return (
    <div className="property-location-picker">
      <div className="location-picker-heading"><div><strong>Property location</strong><small>We use this pin to identify the property and auto-fill its address.</small></div><button className="button secondary" type="button" onClick={useCurrentLocation} disabled={locating}><LocateFixed size={17} />{locating ? "Locating…" : "Use current location"}</button></div>
      <div className="property-map"><MapContainer center={position ?? fallbackCenter} zoom={value ? 17 : 5} scrollWheelZoom><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapInteraction position={position} accuracy={accuracy} onPick={(lat, lng) => void resolvePin(lat, lng)} /></MapContainer>{!value ? <div className="map-empty-hint"><MapPin size={22} /><span>Use your location to place the first pin</span></div> : null}</div>
      <p className="location-status">{status}</p>
      {value ? <div className="resolved-location"><MapPin size={18} /><div><strong>{value.addressLine}</strong><small>{value.city}, {value.stateRegion} · {value.countryCode} · {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</small></div></div> : null}
    </div>
  );
}
