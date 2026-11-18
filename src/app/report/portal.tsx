"use client";
import { useState, useTransition } from "react";
import { ShieldCheck, Scale, Briefcase, HeartHandshake, ArrowLeft, Upload, CheckCircle2, Copy, Globe } from "lucide-react";
import Link from "next/link";
import { submitIntake } from "@/app/actions";
import { Logo, cx } from "@/components/ui";

type Lang = "en" | "es";
type Form = "EEO" | "ER" | "Accommodation";

const T = {
  en: {
    county: "San Bernardino County · Human Resources",
    title: "Report a workplace concern",
    lead: "Employees, applicants and members of the public can use this form. You can report anonymously. Retaliation for reporting in good faith is prohibited.",
    q: "What would you like to report?",
    eeo: ["Discrimination, harassment, or retaliation", "Treatment based on race, sex, sexual orientation, gender identity, disability, age, religion, national origin or another protected characteristic."],
    er: ["Workplace conduct or policy concern", "Unprofessional conduct, policy violations, safety concerns or other workplace issues."],
    acc: ["Request a workplace accommodation", "For a disability, medical condition, or pregnancy, or to return to work after an injury or illness."],
    back: "Back",
    anon: "Submit anonymously",
    anonHelp: "We won't ask for your name. You'll get a private code to check status and answer follow-up questions.",
    name: "Your name",
    contact: "Email or phone",
    relation: "You are a…",
    relations: ["County employee", "Job applicant", "Member of the public", "Contractor/volunteer"],
    basis: "What was the treatment based on? (select all that apply)",
    bases: ["Race or color", "Sex / gender", "Sexual orientation", "Gender identity or expression", "Religion", "National origin or ancestry", "Age (40+)", "Disability", "Medical condition or genetic information", "Pregnancy", "Military or veteran status", "Other / not sure"],
    category: "Type of concern",
    categories: ["Unprofessional conduct", "Policy violation", "Safety concern", "Bullying (not based on a protected characteristic)", "Other"],
    what: "What happened?",
    whatHelp: "Describe what happened, in your own words. Include what was said or done, and how often.",
    when: "When did it happen (or start)?",
    whenFuture: "The date can't be in the future. Choose today or an earlier date.",
    dept: "Department",
    loc: "Work location",
    people: "Who was involved?",
    peopleHelp: "Names or job titles, if you know them.",
    witnesses: "Did anyone else see or hear it?",
    files: "Attach documents, photos, screenshots, audio or video (optional)",
    needAcc: "I need an accommodation to take part in this process (e.g. interpreter, accessible meeting location).",
    accNeed: "What do you need help with at work?",
    workInjury: "Is this related to a work injury or illness?",
    submit: "Submit report",
    sending: "Submitting…",
    doneTitle: "Your report was received",
    ref: "Reference number",
    code: "Your private follow-up code",
    codeHelp: "Save this code. It's the only way to check status or reply to follow-up questions anonymously.",
    next: "What happens next: a trained investigator reviews every report, usually within 2 business days. If you included contact information, we'll reach out to you.",
    privacy: "Your report is encrypted and seen only by authorized HR staff. It's never shared with the people named in it without a legitimate need.",
    another: "Submit another report",
    required: "Required",
    yes: "Yes",
    no: "No",
    chooseFiles: "Choose files",
    secure: "Encrypted in transit and at rest",
    copy: "Copy code",
    genericError: "Something went wrong. Please try again.",
    a11y: "WCAG 2.1 AA · Section 508",
    banner: "Prototype by Concourse for RFP HRD127-HR-6548 · demo environment with synthetic data · not an official County site",
    checkStatus: "Already reported? Check status with your code",
    checkNow: "Check status or reply",
  },
  es: {
    county: "Condado de San Bernardino · Recursos Humanos",
    title: "Reportar una inquietud laboral",
    lead: "Empleados, solicitantes y miembros del público pueden usar este formulario. Puede reportar de forma anónima. Se prohíben las represalias por reportar de buena fe.",
    q: "¿Qué desea reportar?",
    eeo: ["Discriminación, acoso o represalias", "Trato basado en raza, sexo, orientación sexual, identidad de género, discapacidad, edad, religión, origen nacional u otra característica protegida."],
    er: ["Conducta laboral o incumplimiento de políticas", "Conducta poco profesional, violaciones de políticas, problemas de seguridad u otros asuntos laborales."],
    acc: ["Solicitar una adaptación en el trabajo", "Por discapacidad, condición médica o embarazo, o para regresar al trabajo después de una lesión o enfermedad."],
    back: "Atrás",
    anon: "Enviar de forma anónima",
    anonHelp: "No le pediremos su nombre. Recibirá un código privado para consultar el estado y responder preguntas.",
    name: "Su nombre",
    contact: "Correo electrónico o teléfono",
    relation: "Usted es…",
    relations: ["Empleado del Condado", "Solicitante de empleo", "Miembro del público", "Contratista/voluntario"],
    basis: "¿En qué se basó el trato? (seleccione todas las que apliquen)",
    bases: ["Raza o color", "Sexo / género", "Orientación sexual", "Identidad o expresión de género", "Religión", "Origen nacional o ascendencia", "Edad (40+)", "Discapacidad", "Condición médica o información genética", "Embarazo", "Estado militar o de veterano", "Otro / no estoy seguro"],
    category: "Tipo de inquietud",
    categories: ["Conducta poco profesional", "Violación de políticas", "Problema de seguridad", "Hostigamiento (no basado en característica protegida)", "Otro"],
    what: "¿Qué sucedió?",
    whatHelp: "Describa lo que pasó con sus propias palabras. Incluya qué se dijo o hizo y con qué frecuencia.",
    when: "¿Cuándo sucedió (o comenzó)?",
    whenFuture: "La fecha no puede ser futura. Elija hoy o una fecha anterior.",
    dept: "Departamento",
    loc: "Lugar de trabajo",
    people: "¿Quién estuvo involucrado?",
    peopleHelp: "Nombres o puestos, si los conoce.",
    witnesses: "¿Alguien más lo vio o escuchó?",
    files: "Adjunte documentos, fotos, capturas, audio o video (opcional)",
    needAcc: "Necesito una adaptación para participar en este proceso (p. ej., intérprete, lugar accesible).",
    accNeed: "¿Con qué necesita ayuda en el trabajo?",
    workInjury: "¿Está relacionado con una lesión o enfermedad laboral?",
    submit: "Enviar reporte",
    sending: "Enviando…",
    doneTitle: "Recibimos su reporte",
    ref: "Número de referencia",
    code: "Su código privado de seguimiento",
    codeHelp: "Guarde este código. Es la única forma de consultar el estado o responder preguntas de forma anónima.",
    next: "Próximos pasos: un investigador capacitado revisa cada reporte, normalmente en 2 días hábiles. Si incluyó sus datos de contacto, nos comunicaremos con usted.",
    privacy: "Su reporte está cifrado y solo lo ve personal autorizado de RR. HH. Nunca se comparte con las personas mencionadas sin una necesidad legítima.",
    another: "Enviar otro reporte",
    required: "Obligatorio",
    yes: "Sí",
    no: "No",
    chooseFiles: "Elegir archivos",
    secure: "Cifrado en tránsito y en reposo",
    copy: "Copiar código",
    genericError: "Algo salió mal. Inténtelo de nuevo.",
    a11y: "WCAG 2.1 AA · Sección 508",
    banner: "Prototipo de Concourse para la RFP HRD127-HR-6548 · entorno de demostración con datos ficticios · no es un sitio oficial del Condado",
    checkStatus: "¿Ya reportó? Consulte el estado con su código",
    checkNow: "Consultar estado o responder",
  },
};

const SAMPLE = {
  basis: ["Sexual orientation"],
  what: "My supervisor Gary Mills at Yard 4 in Fontana makes jokes about gay people at the 6:30 morning briefings and looks at me when he does it. Last Tuesday he said in front of the whole crew that \"people like that\" don't belong on a road crew. When a coworker told him to knock it off, he said anyone who keeps running their mouth to HR \"is going to regret it.\" This has been going on for a couple of months. I'm afraid of losing overtime or being moved if he finds out I reported this.",
  when: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
  dept: "Public Works",
  loc: "Yard 4 – Fontana",
  people: "Gary Mills (supervisor)",
  witnesses: "Others on the morning crew heard it",
};

export function IntakePortal({ departments }: { departments: string[] }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const [form, setForm] = useState<Form | null>(null);
  const [anon, setAnon] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [basis, setBasis] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [needAcc, setNeedAcc] = useState(false);
  const [done, setDone] = useState<{ reference: string; followUpCode: string | null; routedTo: string; reviewers: string[] } | null>(null);
  const [pending, start] = useTransition();
  const [today] = useState(localToday);
  const [err, setErr] = useState<string | null>(null);
  const whenFuture = !!f.when && f.when > today;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const reset = () => {
    setForm(null);
    setAnon(false);
    setF({});
    setBasis([]);
    setFiles([]);
    setNeedAcc(false);
    setDone(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (whenFuture) {
      setErr(t.whenFuture);
      document.getElementById("when")?.focus();
      return;
    }
    setErr(null);
    start(async () => {
      const r = await submitIntake({
        form: form!,
        language: lang,
        anonymous: anon,
        // Values are stored in English (labels can be Spanish) so staff and reports see one vocabulary.
        payload: { ...f, relation: form !== "Accommodation" ? (f.relation ?? T.en.relations[0]) : undefined, ...(anon ? { name: undefined, contact: undefined } : {}), basis, files, needsAccommodation: needAcc, channel: "Portal" },
      });
      if ("error" in r) return setErr(r.error === "future_date" ? t.whenFuture : t.genericError);
      setDone(r);
      window.scrollTo({ top: 0 });
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f6f2]">
      <div className="bg-night text-night-ink text-[12px] text-center py-1.5 px-4" lang={lang}>{t.banner}</div>
      <header className="bg-surface border-b border-line">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] text-muted">{t.county}</div>
            <div className="text-[17px] font-semibold">{t.title}</div>
          </div>
          <div className="flex items-center gap-1 border border-line rounded-lg p-0.5" role="group" aria-label="Language">
            <Globe size={14} className="mx-1.5 text-muted" />
            {(["en", "es"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={cx("px-2.5 py-1 rounded-md text-[13px] cursor-pointer", lang === l ? "bg-night text-white" : "hover:bg-sunken")} lang={l}>
                {l === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8" lang={lang}>
        {done ? (
          <div className="card p-8">
            <CheckCircle2 className="text-ok" size={34} />
            <h1 className="text-[26px] font-semibold mt-3">{t.doneTitle}</h1>
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <div className="bg-sunken rounded-xl p-4">
                <div className="text-[13px] text-muted">{t.ref}</div>
                <div className="text-[22px] font-semibold font-mono">{done.reference}</div>
              </div>
              {done.followUpCode && (
                <div className="bg-coral-soft rounded-xl p-4 border border-[#f2cdbd]">
                  <div className="text-[13px] text-ink-2">{t.code}</div>
                  <div className="text-[22px] font-semibold font-mono flex items-center gap-2">
                    {done.followUpCode}
                    <button aria-label={t.copy} onClick={() => navigator.clipboard?.writeText(done.followUpCode!)} className="cursor-pointer text-muted hover:text-ink">
                      <Copy size={16} />
                    </button>
                  </div>
                  <div className="text-[12.5px] text-ink-2 mt-1">{t.codeHelp}</div>
                </div>
              )}
            </div>
            <p className="text-[15px] mt-5">{t.next}</p>
            <div className="mt-4 rounded-xl border border-dashed border-line-strong bg-sunken p-3.5 text-[13px] text-ink-2" lang="en">
              <b>Demo:</b> this report went to the <b>{done.routedTo}</b> intake queue. To see it, open the{" "}
              <Link href="/intake" className="underline">staff workspace</Link> and switch to {done.reviewers.join(" or ")}.
            </div>
            <p className="text-[13.5px] text-muted mt-3 flex gap-2">
              <ShieldCheck size={16} className="shrink-0" /> {t.privacy}
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-[14px]">
              {done.followUpCode && (
                <Link href={`/report/status?ref=${encodeURIComponent(done.reference)}&lang=${lang}`} className="underline font-medium">
                  {t.checkNow}
                </Link>
              )}
              <button onClick={reset} className="underline cursor-pointer">
                {t.another}
              </button>
            </div>
          </div>
        ) : !form ? (
          <>
            <p className="text-[16px] leading-relaxed text-ink-2 mb-7">{t.lead}</p>
            <h1 className="text-[22px] font-semibold mb-4">{t.q}</h1>
            <p className="-mt-2 mb-4 text-[14px]">
              <Link href={`/report/status?lang=${lang}`} className="underline">
                {t.checkStatus}
              </Link>
            </p>
            <div className="grid gap-3">
              {(
                [
                  ["EEO", t.eeo, <Scale key="a" size={22} />],
                  ["ER", t.er, <Briefcase key="b" size={22} />],
                  ["Accommodation", t.acc, <HeartHandshake key="c" size={22} />],
                ] as [Form, string[], React.ReactNode][]
              ).map(([k, [title, desc], icon]) => (
                <button key={k} onClick={() => setForm(k)} className="card text-left p-5 flex gap-4 hover:border-slate-2 hover:shadow-sm transition cursor-pointer">
                  <span className="w-11 h-11 rounded-xl bg-slate-4 text-slate flex items-center justify-center shrink-0">{icon}</span>
                  <span>
                    <span className="block text-[17px] font-semibold">{title}</span>
                    <span className="block text-[14.5px] text-muted mt-0.5 leading-snug">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[13px] text-muted mt-6 flex gap-2">
              <ShieldCheck size={15} className="shrink-0" /> {t.privacy}
            </p>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setForm(null)} className="inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink cursor-pointer">
                <ArrowLeft size={15} /> {t.back}
              </button>
              {form === "EEO" && (
                <button
                  type="button"
                  className="text-[12px] text-ai border border-ai-line bg-ai-soft rounded-md px-2 py-1 cursor-pointer"
                  onClick={() => {
                    setAnon(true);
                    setBasis(SAMPLE.basis);
                    setF({ what: SAMPLE.what, when: SAMPLE.when, department: SAMPLE.dept, location: SAMPLE.loc, people: SAMPLE.people, witnesses: SAMPLE.witnesses });
                    setFiles(["briefing-notes-photo.jpg"]);
                  }}
                >
                  Demo: fill example
                </button>
              )}
            </div>
            <h1 className="text-[24px] font-semibold">{form === "EEO" ? t.eeo[0] : form === "ER" ? t.er[0] : t.acc[0]}</h1>

            {form !== "Accommodation" && (
              <label className="card p-4 flex gap-3 cursor-pointer items-start">
                <input type="checkbox" className="mt-1 w-4 h-4" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
                <span>
                  <span className="block font-medium text-[15px]">{t.anon}</span>
                  <span className="block text-[13.5px] text-muted">{t.anonHelp}</span>
                </span>
              </label>
            )}

            {!anon && (
              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <Field label={t.name} required={form === "Accommodation"}>
                  <input className="field" value={f.name ?? ""} onChange={set("name")} required={form === "Accommodation"} autoComplete="name" />
                </Field>
                <Field label={t.contact}>
                  <input className="field" value={f.contact ?? ""} onChange={set("contact")} autoComplete="email" />
                </Field>
              </div>
            )}
            {form !== "Accommodation" && (
              <Field label={t.relation}>
                <select className="field" value={f.relation ?? T.en.relations[0]} onChange={set("relation")}>
                  {t.relations.map((r, i) => (
                    <option key={r} value={T.en.relations[i]}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {form === "EEO" && (
              <fieldset>
                <legend className="text-[14.5px] font-medium mb-2">{t.basis}</legend>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {t.bases.map((b, i) => {
                    const key = T.en.bases[i];
                    return (
                      <label key={b} className="flex items-center gap-2 text-[14px]">
                        <input type="checkbox" className="w-4 h-4" checked={basis.includes(key)} onChange={(e) => setBasis(e.target.checked ? [...basis, key] : basis.filter((x) => x !== key))} />
                        {b}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {form === "ER" && (
              <Field label={t.category}>
                <select className="field" value={f.category ?? ""} onChange={set("category")}>
                  <option value="">—</option>
                  {t.categories.map((c, i) => (
                    <option key={c} value={T.en.categories[i]}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={form === "Accommodation" ? t.accNeed : t.what} help={form === "Accommodation" ? undefined : t.whatHelp} required>
              <textarea className="field min-h-[150px] text-[15px]" value={f.what ?? ""} onChange={set("what")} required />
            </Field>

            <div className="grid sm:grid-cols-3 gap-4 items-end">
              {form !== "Accommodation" && (
                <Field label={t.when}>
                  <input id="when" type="date" className={cx("field", whenFuture && "!border-danger")} max={today} value={f.when ?? ""} onChange={(e) => { setErr(null); set("when")(e); }} aria-invalid={whenFuture} aria-describedby={whenFuture ? "when-error" : undefined} />
                </Field>
              )}
              <Field label={t.dept}>
                <select className="field" value={f.department ?? ""} onChange={set("department")}>
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label={t.loc}>
                <input className="field" value={f.location ?? ""} onChange={set("location")} />
              </Field>
            </div>
            {whenFuture && (
              <p id="when-error" role="alert" className="-mt-3 text-[13.5px] text-danger">
                {t.whenFuture}
              </p>
            )}

            {form === "Accommodation" ? (
              <Field label={t.workInjury}>
                <select className="field" value={f.workInjury ?? ""} onChange={set("workInjury")}>
                  <option value="">—</option>
                  <option>{t.yes}</option>
                  <option>{t.no}</option>
                </select>
              </Field>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <Field label={t.people}>
                  <input className="field" value={f.people ?? ""} onChange={set("people")} placeholder={t.peopleHelp} />
                </Field>
                <Field label={t.witnesses}>
                  <input className="field" value={f.witnesses ?? ""} onChange={set("witnesses")} />
                </Field>
              </div>
            )}

            <Field label={t.files}>
              <label className="block border-2 border-dashed border-line-strong rounded-xl p-5 text-center bg-surface cursor-pointer">
                <Upload className="mx-auto text-muted" size={20} />
                <span className="block text-[14px] mt-1">{files.length ? files.join(", ") : t.chooseFiles}</span>
                <input type="file" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((x) => x.name))} />
              </label>
            </Field>

            {form !== "Accommodation" && (
              <label className="flex gap-2.5 items-start text-[14px]">
                <input type="checkbox" className="mt-0.5 w-4 h-4" checked={needAcc} onChange={(e) => setNeedAcc(e.target.checked)} />
                {t.needAcc}
              </label>
            )}

            <div className="flex items-center gap-4 pt-2">
              {err && !whenFuture && <p role="alert" className="text-[13.5px] text-danger mb-2">{err}</p>}
              <button disabled={pending} className="bg-night text-white rounded-xl px-6 py-3 text-[15px] font-medium hover:bg-night-3 disabled:opacity-60 cursor-pointer">
                {pending ? t.sending : t.submit}
              </button>
              <span className="text-[12.5px] text-muted flex gap-1.5 items-center">
                <ShieldCheck size={14} /> {t.secure}
              </span>
            </div>
          </form>
        )}
      </main>
      <footer className="max-w-3xl mx-auto px-5 pb-10 pt-4 flex items-center justify-between text-[12px] text-muted">
        <span>{t.a11y}</span>
        <span className="flex items-center gap-1.5">
          Powered by <Logo size={13} />
        </span>
      </footer>
    </div>
  );
}

function Field({ label, help, required, children }: { label: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[14.5px] font-medium mb-1">
        {label} {required && <span className="text-coral" aria-hidden>*</span>}
      </span>
      {help && <span className="block text-[13px] text-muted mb-1.5">{help}</span>}
      {children}
    </label>
  );
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
