"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Globe, ShieldCheck, ArrowLeft, Check } from "lucide-react";
import { lookupReport, sendReporterMessage } from "@/app/actions";
import { Logo, cx } from "@/components/ui";

type Lang = "en" | "es";
const T = {
  en: {
    banner: "Prototype by Concourse for RFP HRD127-HR-6548 · demo environment with synthetic data · not an official County site",
    county: "San Bernardino County · Human Resources",
    title: "Check the status of a report",
    lead: "Enter the reference number and private follow-up code you received when you submitted your report. Your identity stays anonymous.",
    ref: "Reference number",
    code: "Follow-up code",
    check: "Check status",
    checking: "Checking…",
    notFound: "We couldn't find a report with that reference number and code. Check both and try again.",
    submitted: "Submitted",
    status: "Current status",
    steps: ["Received", "Under review", "In progress", "Closed"],
    messages: "Messages",
    none: "No messages yet. If the investigator needs more information, their questions will appear here.",
    you: "You",
    hr: "County Human Resources",
    reply: "Send more information to the investigator",
    replyHelp: "Add details, dates or names you remember. Don't include anything that identifies you unless you want to.",
    send: "Send",
    sent: "Sent. The investigator has been notified.",
    privacy: "For your privacy, this page never shows names, findings or other parties' information.",
    back: "Back to the reporting form",
  },
  es: {
    banner: "Prototipo de Concourse para la RFP HRD127-HR-6548 · entorno de demostración con datos ficticios · no es un sitio oficial del Condado",
    county: "Condado de San Bernardino · Recursos Humanos",
    title: "Consultar el estado de un reporte",
    lead: "Ingrese el número de referencia y el código privado que recibió al enviar su reporte. Su identidad sigue siendo anónima.",
    ref: "Número de referencia",
    code: "Código de seguimiento",
    check: "Consultar estado",
    checking: "Consultando…",
    notFound: "No encontramos un reporte con ese número de referencia y código. Revise ambos e inténtelo de nuevo.",
    submitted: "Enviado",
    status: "Estado actual",
    steps: ["Recibido", "En revisión", "En curso", "Cerrado"],
    messages: "Mensajes",
    none: "Aún no hay mensajes. Si el investigador necesita más información, sus preguntas aparecerán aquí.",
    you: "Usted",
    hr: "Recursos Humanos del Condado",
    reply: "Enviar más información al investigador",
    replyHelp: "Agregue detalles, fechas o nombres que recuerde. No incluya nada que lo identifique a menos que lo desee.",
    send: "Enviar",
    sent: "Enviado. Se notificó al investigador.",
    privacy: "Para proteger su privacidad, esta página nunca muestra nombres, conclusiones ni información de otras personas.",
    back: "Volver al formulario de reporte",
  },
};

const ES_STATUS: Record<string, string> = {
  "Received — being reviewed": "Recibido — en revisión",
  "Under review by an investigator": "En revisión por un investigador",
  "Investigation in progress": "Investigación en curso",
  "Findings being finalized": "Conclusiones en preparación",
  "Open — temporarily on hold": "Abierto — en pausa temporal",
  Closed: "Cerrado",
  "Reviewed — no further action": "Revisado — sin más acciones",
};

type Found = Extract<Awaited<ReturnType<typeof lookupReport>>, { ok: true }>;

export function StatusLookup({ initialRef, initialLang }: { initialRef: string; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const [ref, setRef] = useState(initialRef);
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "es" ? "es-US" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
  const lookup = () =>
    start(async () => {
      const r = await lookupReport(ref, code);
      setNotFound(!r.ok);
      setRes(r.ok ? r : null);
    });

  return (
    <div className="min-h-screen bg-[#f6f6f2]">
      <div className="bg-night text-night-ink text-[12px] text-center py-1.5 px-4">{t.banner}</div>
      <header className="bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] text-muted">{t.county}</div>
            <div className="text-[17px] font-semibold">{t.title}</div>
          </div>
          <div className="flex items-center gap-1 border border-line rounded-lg p-0.5" role="group" aria-label="Language">
            <Globe size={14} className="mx-1.5 text-muted" aria-hidden />
            {(["en", "es"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={cx("px-2.5 py-1 rounded-md text-[13px] cursor-pointer", lang === l ? "bg-night text-white" : "hover:bg-sunken")} lang={l}>
                {l === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-5" lang={lang}>
        <Link href="/report" className="inline-flex items-center gap-1 text-[13px] underline">
          <ArrowLeft size={13} /> {t.back}
        </Link>
        <form
          className="card p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
        >
          <p className="text-[15px] text-ink-2">{t.lead}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[14px] font-medium mb-1">{t.ref}</span>
              <input className="field font-mono" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="SBC-EEO-48500" required autoComplete="off" />
            </label>
            <label className="block">
              <span className="block text-[14px] font-medium mb-1">{t.code}</span>
              <input className="field font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-1234" required autoComplete="off" />
            </label>
          </div>
          <button disabled={pending} className="bg-night text-white rounded-xl px-5 py-2.5 text-[14.5px] font-medium hover:bg-night-3 disabled:opacity-60 cursor-pointer">
            {pending && !res ? t.checking : t.check}
          </button>
          {notFound && (
            <p role="alert" className="text-[13.5px] text-danger">
              {t.notFound}
            </p>
          )}
        </form>

        {res && (
          <>
            <section className="card p-6" aria-live="polite">
              <div className="text-[13px] text-muted">
                {res.reference} · {t.submitted} {fmt(res.submitted)}
              </div>
              <h2 className="text-[13px] text-muted mt-4">{t.status}</h2>
              <div className="text-[20px] font-semibold">{lang === "es" ? (ES_STATUS[res.status.label] ?? res.status.label) : res.status.label}</div>
              <ol className="flex mt-4 gap-1.5" aria-label={t.status}>
                {t.steps.map((st, i) => {
                  const n = i + 1;
                  const state = n < res.status.step ? "done" : n === res.status.step ? "current" : "todo";
                  return (
                    <li key={st} aria-current={state === "current" ? "step" : undefined} className={cx("flex-1 rounded-lg px-2 py-2 text-[12.5px] text-center border", state === "done" && "bg-slate-4 border-slate-4", state === "current" && "bg-night text-white border-night font-medium", state === "todo" && "border-line text-faint")}>
                      {state === "done" && <Check size={11} className="inline mr-1 -mt-0.5" aria-hidden />}
                      {st}
                    </li>
                  );
                })}
              </ol>
            </section>
            <section className="card p-6">
              <h2 className="text-[15px] font-semibold mb-3">{t.messages}</h2>
              {res.messages.length === 0 ? (
                <p className="text-[13.5px] text-muted">{t.none}</p>
              ) : (
                <ul className="space-y-3">
                  {res.messages.map((m, i) => (
                    <li key={i} className={cx("rounded-xl p-3.5 text-[14px]", m.from === "You" ? "bg-sunken ml-8" : "bg-ai-soft mr-8")}>
                      <div className="text-[12px] text-muted mb-1">
                        {m.from === "You" ? t.you : t.hr} · {fmt(m.at)}
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-5 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!msg.trim()) return;
                  start(async () => {
                    const r = await sendReporterMessage(ref, code, msg);
                    if (r.ok) {
                      setMsg("");
                      setSent(true);
                      const again = await lookupReport(ref, code);
                      if (again.ok) setRes(again);
                    }
                  });
                }}
              >
                <label className="block">
                  <span className="block text-[14px] font-medium mb-1">{t.reply}</span>
                  <span className="block text-[13px] text-muted mb-1.5">{t.replyHelp}</span>
                  <textarea className="field min-h-[100px]" value={msg} onChange={(e) => (setMsg(e.target.value), setSent(false))} />
                </label>
                <div className="flex items-center gap-3">
                  <button disabled={pending || !msg.trim()} className="bg-night text-white rounded-lg px-4 py-2 text-[14px] disabled:opacity-50 cursor-pointer">
                    {t.send}
                  </button>
                  {sent && (
                    <span role="status" className="text-[13px] text-ok">
                      {t.sent}
                    </span>
                  )}
                </div>
              </form>
            </section>
          </>
        )}
        <p className="text-[12.5px] text-muted flex gap-1.5">
          <ShieldCheck size={14} className="shrink-0 mt-0.5" aria-hidden /> {t.privacy}
        </p>
      </main>
      <footer className="max-w-2xl mx-auto px-5 pb-10 flex justify-end text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          Powered by <Logo size={13} />
        </span>
      </footer>
    </div>
  );
}
