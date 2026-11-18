import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_PERSONA, personaById, type Persona } from "./personas";

export const PERSONA_COOKIE = "demo_persona";

/** Stage-1 stand-in for SSO: the persona switcher sets a cookie. */
export async function currentUser(): Promise<Persona> {
  const jar = await cookies();
  return personaById(jar.get(PERSONA_COOKIE)?.value ?? DEFAULT_PERSONA);
}
