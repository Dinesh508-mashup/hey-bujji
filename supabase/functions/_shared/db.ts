// Minimal PostgREST access with the service-role key (edge functions only).
import { DEMO_FAMILY, type Family } from "./lexicon.ts";

type Env = { url?: string; serviceKey?: string };

function headers(env: Env) {
  return {
    apikey: env.serviceKey!,
    authorization: `Bearer ${env.serviceKey}`,
    "content-type": "application/json",
  };
}

/** Family, medicines and contacts from the database; falls back to the built-in demo family. */
export async function loadFamily(env: Env, familyId: string): Promise<Family> {
  if (!env.url || !env.serviceKey) return DEMO_FAMILY;
  try {
    const q = (path: string) => fetch(`${env.url}/rest/v1/${path}`, { headers: headers(env) }).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
    const [fam, meds, contacts] = await Promise.all([
      q(`families?id=eq.${encodeURIComponent(familyId)}&select=*`),
      q(`medicines?family_id=eq.${encodeURIComponent(familyId)}&select=*`),
      q(`contacts?family_id=eq.${encodeURIComponent(familyId)}&select=*`),
    ]);
    if (!fam.length) return DEMO_FAMILY;
    return {
      id: familyId,
      parentName: fam[0].parent_name ?? "Amma",
      medicines: meds.map((m: Record<string, unknown>) => ({ name: m.name, purpose: m.purpose ?? undefined, variants: (m.variants as string[]) ?? [] })),
      contacts: contacts.map((c: Record<string, unknown>) => ({ name: c.name, relation: c.relation, phone: c.phone, nicknames: (c.nicknames as string[]) ?? [] })),
    } as Family;
  } catch (e) {
    console.error("loadFamily failed, using demo family:", e);
    return DEMO_FAMILY;
  }
}

export async function insertEvent(env: Env, row: {
  family_id: string; type: string; summary: string; urgency: string; details: unknown;
}): Promise<void> {
  if (!env.url || !env.serviceKey) return;
  const res = await fetch(`${env.url}/rest/v1/events`, {
    method: "POST",
    headers: { ...headers(env), prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) console.error("insertEvent failed", res.status, await res.text());
}
