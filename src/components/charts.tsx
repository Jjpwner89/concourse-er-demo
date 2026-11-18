"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SLATE = "#3e4a4f";
const GRID = "#e6e6df";
const AXIS = "#6a7276";

type Row = { label: string; value: number; suppressed?: boolean };

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="card shadow-lg px-3 py-2 text-[12.5px]">
      <div className="text-muted">{r.label}</div>
      <div className="font-semibold text-ink">{r.suppressed ? "<3 (suppressed)" : r.value}</div>
    </div>
  );
}

/** Text alternative for every chart: a visually hidden table with the same numbers (WCAG 1.1.1). */
function DataTable({ data, label }: { data: Row[]; label?: string }) {
  return (
    <table className="sr-only">
      {label && <caption>{label}</caption>}
      <tbody>
        {data.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{r.suppressed ? "fewer than 3 (suppressed for privacy)" : r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BarsV({ data, height = 220, label }: { data: Row[]; height?: number; label?: string }) {
  return (
    <>
    <DataTable data={data} label={label} />
    <div aria-hidden>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11.5 }} interval={0} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(62,74,79,0.06)" }} />
        <Bar dataKey="value" fill={SLATE} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
    </div>
    </>
  );
}

export function BarsH({ data, label }: { data: Row[]; label?: string }) {
  const h = Math.max(140, data.length * 30 + 20);
  return (
    <>
    <DataTable data={data} label={label} />
    <div aria-hidden>
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11.5 }} />
        <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fill: "#3c4448", fontSize: 12 }} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(62,74,79,0.06)" }} />
        <Bar dataKey="value" fill={SLATE} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
    </div>
    </>
  );
}
