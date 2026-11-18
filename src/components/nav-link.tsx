"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { ReactNode } from "react";

export function NavLink({ href, icon, count, children }: { href: string; icon: ReactNode; count?: number; children: ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition",
        active ? "bg-night-3 text-white" : "text-night-muted hover:text-night-ink hover:bg-night-2",
      )}
    >
      {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-white" />}
      {icon}
      <span className="flex-1">{children}</span>
      {!!count && (
        <span className="text-[11px] font-semibold bg-coral text-white rounded-full px-1.5 min-w-[18px] text-center">
          {count}
          <span className="sr-only"> new</span>
        </span>
      )}
    </Link>
  );
}
