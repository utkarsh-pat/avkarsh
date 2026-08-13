"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { label: string; revenue: number; occupancy: number };

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function PropertyDashboardCharts({ data }: { data: Point[] }) {
  return <section className="owner-chart-grid" aria-label="Seven day property trends">
    <article className="owner-chart-card"><header><div><p className="eyebrow">LAST 7 DAYS</p><h2>Gross room revenue</h2></div><span>Booked value</span></header><div className="owner-chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => [currency(Number(value)), "Revenue"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 11 }} /><Area type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2.5} fill="#1d4ed8" fillOpacity={0.16} /></AreaChart></ResponsiveContainer></div></article>
    <article className="owner-chart-card"><header><div><p className="eyebrow">ROOM UTILISATION</p><h2>Daily occupancy</h2></div><span>Occupied units</span></header><div className="owner-chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--hairline)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => [`${value}%`, "Occupancy"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 11 }} /><Bar dataKey="occupancy" fill="#0f766e" radius={[6, 6, 2, 2]} maxBarSize={34} /></BarChart></ResponsiveContainer></div></article>
  </section>;
}
