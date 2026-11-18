"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

export function GlobalSearch({ disabled }: { disabled?: boolean }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  if (disabled) return <div className="text-[12.5px] text-night-muted">Administrative console</div>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}&ai=1`);
      }}
      className="flex items-center gap-2 bg-night-2 border border-night-3 rounded-lg px-3 py-1.5 w-full max-w-[520px] focus-within:border-slate-2"
    >
      <Search size={15} className="text-night-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search cases, or ask: “open harassment cases in Public Works”"
        aria-label="Search cases"
        className="bg-transparent outline-none text-[13.5px] w-full placeholder:text-night-muted"
      />
      <Sparkles size={14} className="text-[#a9b0e6]" aria-hidden />
    </form>
  );
}
