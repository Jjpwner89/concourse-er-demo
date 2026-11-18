"use client";
import { useEffect } from "react";

/** Opens the browser's print dialog (choose "Save as PDF" for a PDF). */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button onClick={() => window.print()} className="print:hidden fixed top-4 right-4 bg-night text-white rounded-lg px-3 py-1.5 text-[13px] cursor-pointer">
      Print / Save as PDF
    </button>
  );
}
