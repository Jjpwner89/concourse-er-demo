import { StatusLookup } from "./lookup";

export const metadata = { title: "Check report status · San Bernardino County (prototype)" };

export default async function StatusPage({ searchParams }: PageProps<"/report/status">) {
  const sp = await searchParams;
  return <StatusLookup initialRef={typeof sp.ref === "string" ? sp.ref : ""} initialLang={sp.lang === "es" ? "es" : "en"} />;
}
