"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, MessageSquare, Mail } from "lucide-react";
import { markNotificationsRead } from "@/app/actions";

type N = { id: number; text: string; href: string | null; read: boolean; channel: string; createdAt: string };

export function Notifications({ items }: { items: N[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => {
          setOpen(!open);
          if (!open && unread) start(() => markNotificationsRead());
        }}
        className="relative p-2 rounded-lg hover:bg-night-2 cursor-pointer"
      >
        <Bell size={17} />
        {unread > 0 && <span className="absolute top-1 right-1 text-[10px] font-semibold bg-coral text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] card shadow-xl text-ink z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line eyebrow">Notifications</div>
          <div className="max-h-[400px] overflow-auto">
            {items.length === 0 && <div className="p-4 text-[13px] text-muted">You&apos;re all caught up.</div>}
            {items.map((n) => {
              const body = (
                <div className="flex gap-2.5 px-4 py-2.5 hover:bg-sunken">
                  <span className="mt-0.5 text-muted">{n.channel === "Teams" ? <MessageSquare size={14} /> : n.channel === "Outlook" ? <Mail size={14} /> : <Bell size={14} />}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] leading-snug">{n.text}</div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {n.channel !== "In-app" ? `via ${n.channel} · ` : ""}
                      {new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block border-b border-line last:border-0">
                  {body}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-line last:border-0">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
