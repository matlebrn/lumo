// Lumo · connexion bancaire via Enable Banking.
// Les soldes et les opérations sont rangés dans les tables « comptes » et « operations » de leur propriétaire.
import { createClient } from "npm:@supabase/supabase-js@2";

const EB = "https://api.enablebanking.com";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
const FN = `${SB_URL}/functions/v1/bank`;
const APPLI = (Deno.env.get("LUMO_APP_URL") ?? "https://lumo-argent.vercel.app").replace(/\/$/, "");
const QUOTA = 4; // accès sans l'utilisateur autorisés par la banque (DSP2) par 24 h

// ---------- JWT RS256 ----------
const b64u = (b: Uint8Array | string) => {
  const s = typeof b === "string" ? btoa(unescape(encodeURIComponent(b))) : btoa(String.fromCharCode(...b));
  return s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};
function derLen(n: number) { if (n < 128) return [n]; const o: number[] = []; while (n) { o.unshift(n & 255); n >>= 8; } return [0x80 | o.length, ...o]; }
function pkcs1to8(p1: Uint8Array) {
  const alg = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const oct = [0x04, ...derLen(p1.length), ...p1];
  const body = [0x02, 0x01, 0x00, ...alg, ...oct];
  return new Uint8Array([0x30, ...derLen(body.length), ...body]);
}
let keyP: Promise<CryptoKey> | null = null;
function key() {
  if (keyP) return keyP;
  const pem = (Deno.env.get("EB_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n").trim();
  if (!pem) throw new Error("Clé EB_PRIVATE_KEY manquante");
  const rsa = /RSA\s+PRIVATE/i.test(pem);
  let b64 = pem.replace(/(BEGIN|END)\s+(RSA\s+)?PRIVATE\s+KEY/gi, "").replace(/[^A-Za-z0-9+/=]/g, "");
  const m0 = b64.indexOf("MII"); if (m0 > 0) b64 = b64.slice(m0);
  b64 = b64.replace(/=+(?=.)/g, "");
  const endOk = /END\s+(RSA\s+)?PRIVATE\s+KEY/i.test(pem), begOk = /BEGIN\s+(RSA\s+)?PRIVATE\s+KEY/i.test(pem);
  if (b64.length % 4 === 3) b64 += "="; else if (b64.length % 4 === 2) b64 += "==";
  if (!b64.startsWith("MII") || b64.length % 4 !== 0 || !endOk) throw new Error(`Clé incomplète ou mal copiée : ${b64.length} caractères utiles (attendu environ 3100 à 3300), début « ${b64.slice(0, 3)} », ligne BEGIN ${begOk ? "présente" : "absente"}, ligne END ${endOk ? "présente" : "absente"}`);
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  keyP = crypto.subtle.importKey("pkcs8", rsa ? pkcs1to8(raw) : raw, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]).catch((e) => { throw new Error(`Clé illisible (${b64.length} caractères, début « ${b64.slice(0, 3)} ») : ${e.message}`); });
  keyP.catch(() => { keyP = null; });
  return keyP;
}
async function jwt() {
  const kid = (Deno.env.get("EB_APP_ID") ?? "").trim();
  if (!kid) throw new Error("Identifiant EB_APP_ID manquant");
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ typ: "JWT", alg: "RS256", kid }));
  const p = b64u(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await key(), new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64u(sig)}`;
}
async function eb(path: string, init: RequestInit = {}) {
  const r = await fetch(EB + path, { ...init, headers: { Authorization: `Bearer ${await jwt()}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
  if (!r.ok) throw new Error(`Enable Banking ${r.status} ${path.split("?")[0]} : ${(j && (j.message || j.error)) || t.slice(0, 200)}`);
  return j;
}


const J = (o: unknown, status = 200) => Response.json(o, { status });
async function log(ok: boolean, msg: string) { await db.from("eb_sync_log").insert({ ok, msg: msg.slice(0, 900) }); }
const jour = (d: Date) => d.toISOString().slice(0, 10);
async function hash(s: string) { const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); return Array.from(d.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join(""); }

function libelle(t: any) {
  const ri = (t.remittance_information ?? []).filter(Boolean).join(" ").trim();
  const cp = (t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name) ?? "";
  return (ri || cp || t.note || "Opération").replace(/\s+/g, " ").slice(0, 140);
}
const estEpargne = (a: any) => a.cash_account_type === "SVGS" || /livret|[ée]pargne|\bLDD|\bLEP\b|\bPEL\b|\bCEL\b/i.test(`${a.name ?? ""} ${a.product ?? ""}`);

// ---------- un compte : son solde, puis ses opérations ----------
const COMPTABLE = ["CLBD", "ITBD", "OPBD", "PRCD", "INFO"], DISPONIBLE = ["ITAV", "CLAV", "XPCD", "FWAV"];
const premier = (L: any[], ordre: string[]) => L.filter((x) => ordre.includes(x.balance_type)).sort((x, y) => ordre.indexOf(x.balance_type) - ordre.indexOf(y.balance_type))[0];
const nombre = (v: unknown) => { const x = +String(v ?? "").replace(",", "."); return isFinite(x) ? x : null; };

async function syncCompte(acc: any, s: any, depuis: string, ph?: Record<string, string>, premiere = false) {
  // soldes : le comptable (ce qui est passé) et le disponible (ce que la banque laisse dépenser)
  let solde: number | null = null, dispo: number | null = null;
  try {
    const L = (await eb(`/accounts/${acc.uid}/balances`, { headers: ph ?? {} })).balances ?? [];
    const c = premier(L, COMPTABLE) ?? L[0], d = premier(L, DISPONIBLE);
    if (c) solde = nombre(c.balance_amount?.amount);
    if (d) dispo = nombre(d.balance_amount?.amount);
  } catch (e) { await log(false, `solde ${s.bank} : ${(e as Error).message}`); }
  const infos: Record<string, unknown> = {
    iban: acc.account_id?.iban ?? null, devise: acc.currency ?? null,
    decouvert: nombre(acc.credit_limit?.amount), solde_dispo: dispo,
  };
  let { data: c } = await db.from("comptes").select("id,eb_uid").eq("eb_uid", acc.uid).maybeSingle();
  // accès renouvelé : la banque donne un nouvel identifiant au même compte, on le retrouve par son IBAN
  if (!c && infos.iban) ({ data: c } = await db.from("comptes").select("id,eb_uid").eq("user_id", s.user_id).eq("source", "banque").eq("iban", infos.iban as string).limit(1).maybeSingle());
  if (c) await db.from("comptes").update({ ...infos, ...(solde != null ? { solde } : {}), maj: new Date().toISOString(), session_id: s.session_id }).eq("id", c.id);
  else {
    const r = await db.from("comptes").insert({ user_id: s.user_id, nom: acc.name ?? acc.product ?? s.bank, type: estEpargne(acc) ? "epargne" : "courant", solde: solde ?? 0, source: "banque", banque: s.bank, session_id: s.session_id, eb_uid: acc.uid, ...infos }).select("id").single();
    if (r.error) throw new Error(r.error.message);
    c = { id: r.data.id, eb_uid: acc.uid };
  }
  const prefixe = c!.eb_uid || acc.uid; // même préfixe qu'avant le renouvellement : pas de doublons
  // opérations : à la première connexion, on remonte le plus loin possible (2 ans, sinon ce que la banque permet)
  const lire = async (date_from: string) => {
    const lignes: any[] = []; let ck: string | null = null, tours = 0;
    do {
      const q = new URLSearchParams({ date_from });
      if (ck) q.set("continuation_key", ck);
      const r = await eb(`/accounts/${acc.uid}/transactions?${q}`, { headers: ph ?? {} });
      lignes.push(...(r.transactions ?? []));
      ck = r.continuation_key ?? null;
    } while (ck && ++tours < 60);
    return lignes;
  };
  let T: any[] = [];
  if (premiere) {
    let ok = false;
    for (const jours of [730, 540, 400, 365, 180, 90]) {
      try { T = await lire(jour(new Date(Date.now() - jours * 864e5))); ok = true; break; } catch (e) { const m = (e as Error).message; if (/\b429\b/.test(m) || !/\b4\d\d\b/.test(m)) throw e; } // période refusée : on essaie plus court
    }
    if (!ok) T = await lire(depuis);
  } else T = await lire(depuis);
  const rows: any[] = [], enCours: any[] = [];
  for (const [i, t] of T.entries()) {
    const statut = !t.status || t.status === "BOOK" ? "BOOK" : t.status === "PDNG" ? "PDNG" : null;
    if (!statut) continue; // annulées, rejetées…
    const debit = t.credit_debit_indicator === "DBIT";
    const montant = nombre(t.transaction_amount?.amount);
    const date = t.booking_date ?? t.value_date ?? t.transaction_date;
    if (!date || montant == null) continue;
    const lib = libelle(t);
    const ligne = {
      user_id: s.user_id, compte_id: c!.id, date, montant: montant * (debit ? -1 : 1), libelle: lib, statut,
      contrepartie: ((debit ? t.creditor?.name : t.debtor?.name) ?? null)?.slice(0, 140) ?? null,
      contrepartie_iban: (debit ? t.creditor_account?.iban : t.debtor_account?.iban) ?? null,
      mcc: t.merchant_category_code ?? null, date_valeur: t.value_date ?? null,
      code_banque: (t.bank_transaction_code?.description ?? t.bank_transaction_code?.code ?? null)?.slice(0, 80) ?? null,
    };
    const ref = t.entry_reference || t.transaction_id || (await hash(`${date}|${montant}|${lib}|${i}`));
    (statut === "PDNG" ? enCours : rows).push({ id: `${prefixe}:${statut === "PDNG" ? "p:" : ""}${ref}`, ...ligne });
  }
  // les opérations en cours changent ou disparaissent quand elles passent : on les remplace à chaque fois
  await db.from("operations").delete().eq("compte_id", c!.id).eq("statut", "PDNG");
  for (const lot of [rows, enCours]) for (let k = 0; k < lot.length; k += 500) {
    const { error } = await db.from("operations").upsert(lot.slice(k, k + 500), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  return rows.length + enCours.length;
}

// ---------- toutes les banques (ou celles d'une personne) ----------
// Créneaux des actualisations automatiques, heure de Paris : matin, midi, fin d'après-midi, soir.
// Le jour de la paie (et la veille), on regarde plus tôt et plus souvent pour la voir arriver.
function bonMoment(jourPaie?: number, maintenant = new Date()) {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", day: "numeric", hourCycle: "h23" });
  const parts = Object.fromEntries(f.formatToParts(maintenant).map((x) => [x.type, x.value]));
  const h = +parts.hour, j = +parts.day;
  const paie = jourPaie && (j === jourPaie || j === jourPaie - 1 || (jourPaie > 28 && j >= 28));
  return (paie ? [7, 10, 14, 19] : [7, 12, 17, 21]).includes(h);
}

async function syncTout(o: { session?: string; user?: string; ph?: Record<string, string>; complet?: boolean } = {}) {
  let q = db.from("eb_sessions").select("*").neq("status", "REVOKED").not("user_id", "is", null);
  if (o.session) q = q.eq("session_id", o.session);
  if (o.user) q = q.eq("user_id", o.user);
  const { data: S } = await q;
  const out: string[] = [];
  // jour de paie de chacun, pour actualiser plus tôt et plus souvent ces jours-là
  const paies = new Map<string, number>();
  if (!o.session && !o.ph && S?.length) {
    const { data: P } = await db.from("profils").select("user_id,jour_paie").in("user_id", [...new Set(S.map((x: any) => x.user_id))]);
    for (const p of P ?? []) if (p.jour_paie) paies.set(p.user_id, p.jour_paie);
  }
  for (const s of S ?? []) {
    try {
      if (s.valid_until && new Date(s.valid_until) < new Date()) { await db.from("eb_sessions").update({ status: "EXPIRED" }).eq("session_id", s.session_id); out.push(`${s.bank} : accès expiré, à renouveler`); continue; }
      if (!o.session && !o.ph) { // synchro automatique, sans l'utilisateur : la banque en autorise 4 par 24 h
        const calls: number[] = (Array.isArray(s.calls) ? s.calls : []).map((t: string) => new Date(t).getTime()).filter((t: number) => Date.now() - t < 23.5 * 3600e3);
        if (!bonMoment(paies.get(s.user_id))) continue; // pas un créneau utile : rien à faire cette heure-ci
        if (calls.length >= QUOTA) { out.push(`${s.bank} : quota du jour atteint`); continue; }
        if (s.last_sync && Date.now() - new Date(s.last_sync).getTime() < 90 * 60e3) { out.push(`${s.bank} : déjà à jour`); continue; }
        calls.push(Date.now());
        await db.from("eb_sessions").update({ calls: calls.map((t) => new Date(t).toISOString()) }).eq("session_id", s.session_id);
      }
      const info = await eb(`/sessions/${s.session_id}`);
      if (info.status && info.status !== "AUTHORIZED") { await db.from("eb_sessions").update({ status: info.status }).eq("session_id", s.session_id); out.push(`${s.bank} : ${info.status}`); continue; }
      const depuis = s.last_sync ? jour(new Date(new Date(s.last_sync).getTime() - 10 * 864e5)) : jour(new Date(Date.now() - 400 * 864e5));
      let n = 0;
      for (const a of s.accounts ?? []) n += await syncCompte(a, s, depuis, o.ph, !s.last_sync || !!o.complet);
      await db.from("eb_sessions").update({ last_sync: new Date().toISOString(), status: "AUTHORIZED", error: null }).eq("session_id", s.session_id);
      out.push(`${s.bank} : ${(s.accounts ?? []).length} compte(s), ${n} opération(s)`);
    } catch (e) {
      const brut = (e as Error).message;
      const m = /\b429\b/.test(brut) ? "La banque limite le nombre de mises à jour par jour. Lumo réessaiera plus tard." : brut;
      await db.from("eb_sessions").update({ error: m }).eq("session_id", s.session_id);
      out.push(`${s.bank} : erreur — ${m}`);
    }
  }
  if (!out.length && S?.length) return "Rien à faire à cette heure-ci"; // pas un créneau utile : on ne note rien
  const msg = out.join(" · ") || "Aucune banque connectée";
  await log(!out.some((x) => /erreur/.test(x)), msg);
  return msg;
}

async function couper(s: any) { // retire une banque : accès révoqué, comptes et opérations effacés
  try { await fetch(`${EB}/sessions/${s.session_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${await jwt()}` } }); } catch { /* */ }
  await db.from("comptes").delete().eq("session_id", s.session_id);
  await db.from("eb_sessions").delete().eq("session_id", s.session_id);
}

// ---------- routes de l'appli (utilisateur connecté) ----------
const ORIGINE_OK = /^(https:\/\/lumo[a-z0-9-]*\.vercel\.app|http:\/\/localhost(:\d+)?|http:\/\/127\.0\.0\.1(:\d+)?)$/;
function cors(req: Request, r: Response) {
  const o = req.headers.get("origin") ?? "";
  if (ORIGINE_OK.test(o)) { r.headers.set("Access-Control-Allow-Origin", o); r.headers.set("Vary", "Origin"); }
  r.headers.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  r.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return r;
}
function psu(h: Headers) { // preuve pour la banque que l'utilisateur est présent : pas de quota
  const ph: Record<string, string> = {}, ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (ip) ph["Psu-Ip-Address"] = ip;
  for (const [k, nom] of [["user-agent", "Psu-User-Agent"], ["accept", "Psu-Accept"], ["accept-language", "Psu-Accept-language"], ["accept-encoding", "Psu-Accept-Encoding"], ["referer", "Psu-Referer"]]) if (h.get(k)) ph[nom] = h.get(k)!;
  ph["Psu-Accept-Charset"] = "utf-8";
  return ph["Psu-Ip-Address"] && ph["Psu-User-Agent"] ? ph : undefined;
}
const pasActivee = (m: string) => /EB_APP_ID|EB_PRIVATE_KEY|Clé (incomplète|illisible)/.test(m);

async function routeUtilisateur(req: Request, path: string): Promise<Response> {
  const jeton = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: ud } = jeton ? await db.auth.getUser(jeton) : ({ data: { user: null } } as any);
  const uid = ud?.user?.id as string | undefined;
  if (!uid) return J({ ok: false, msg: "Connexion requise" }, 401);
  const body: any = await req.json().catch(() => ({}));
  const { data: S } = await db.from("eb_sessions").select("*").eq("user_id", uid);
  const miennes = S ?? [];

  if (path === "/u/banques") { // liste des banques françaises, gardée 7 jours
    const { data: v } = await db.from("eb_banks").select("updated_at").eq("country", "FR").limit(1);
    if (!v?.length || Date.now() - new Date(v[0].updated_at).getTime() > 7 * 864e5) {
      const r = await eb(`/aspsps?country=FR&psu_type=personal`);
      const rows = (r.aspsps ?? []).map((a: any) => ({ name: a.name, country: "FR", max_days: a.maximum_consent_validity ? Math.floor(a.maximum_consent_validity / 86400) : null, logo: a.logo ?? null, updated_at: new Date().toISOString() }));
      if (rows.length) await db.from("eb_banks").upsert(rows, { onConflict: "name,country" });
    }
    return J({ ok: true });
  }
  if (path === "/u/connecter") { // renvoie l'adresse de la banque où l'utilisateur donne son accord
    const banque = String(body.banque || "");
    const { data: bk } = await db.from("eb_banks").select("max_days").eq("name", banque).eq("country", "FR").maybeSingle();
    if (!bk) return J({ ok: false, msg: "Banque inconnue" }, 400);
    // version gratuite : une banque (on peut toujours renouveler l'accès à celle-ci)
    const { data: plan } = await db.rpc("plan_de", { uid });
    if (plan !== "plus" && miennes.some((x: any) => x.status === "AUTHORIZED" && x.bank !== banque)) return J({ ok: false, code: "limite", msg: "La version gratuite connecte une banque. Lumo Plus les connecte toutes." }, 403);
    const state = crypto.randomUUID();
    await db.from("eb_states").insert({ state, bank: banque, country: "FR", user_id: uid, retour: body.retour === "appli" ? "appli" : "web" });
    const jours = Math.min(bk.max_days ? Math.max(1, bk.max_days) : 90, 180);
    const r = await eb("/auth", { method: "POST", body: JSON.stringify({ access: { valid_until: new Date(Date.now() + jours * 864e5 - 60e3).toISOString() }, aspsp: { name: banque, country: "FR" }, state, redirect_url: `${FN}/callback`, psu_type: "personal", language: "fr" }) });
    return J({ ok: true, url: r.url });
  }
  if (path === "/u/sync") {
    if (!miennes.length) return J({ ok: true, msg: "Aucune banque connectée" });
    if (miennes.every((x: any) => x.last_sync && Date.now() - new Date(x.last_sync).getTime() < 120e3)) return J({ ok: true, msg: "Déjà à jour" });
    const msg = await syncTout({ user: uid, ph: psu(req.headers), complet: body.complet === true });
    return J({ ok: !/erreur/.test(msg), msg });
  }
  if (path === "/u/retirer") {
    const s = miennes.find((x: any) => x.session_id === String(body.session || ""));
    if (!s) return J({ ok: false, msg: "Banque introuvable" }, 404);
    await couper(s);
    return J({ ok: true });
  }
  if (path === "/u/supprimer-compte") { // efface définitivement le compte Lumo et toutes ses données
    for (const s of miennes) await couper(s);
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return J({ ok: true });
  }
  return J({ ok: false, msg: "Route inconnue" }, 404);
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const path = u.pathname.replace(/^(\/functions\/v1)?\/bank/, "") || "/";
  if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
  if (path.startsWith("/u/")) {
    return cors(req, await routeUtilisateur(req, path).catch(async (e) => {
      const m = (e as Error).message;
      await log(false, `${path} : ${m}`).catch(() => {});
      return pasActivee(m) ? J({ ok: false, code: "pas_activee", msg: "La connexion bancaire n’est pas encore activée." }, 503) : J({ ok: false, msg: m }, 500);
    }));
  }
  // après la banque : retour dans l'appli iPhone / Android, ou sur le site (deux destinations fixes)
  let vers = "web";
  const retour = (etat: string) => Response.redirect(vers === "appli" ? `lumo://banque?etat=${etat}` : `${APPLI}/?banque=${etat}`, 302);
  try {
    if (path === "/callback") { // retour de la banque après l'accord de l'utilisateur
      const code = u.searchParams.get("code"), state = u.searchParams.get("state") ?? "";
      const { data: st } = await db.from("eb_states").select("*").eq("state", state).maybeSingle();
      if (st?.retour === "appli") vers = "appli";
      if (u.searchParams.get("error")) return retour("annulee");
      if (!st || !code || !st.user_id || Date.now() - new Date(st.created_at).getTime() > 45 * 60e3) return retour("expiree");
      await db.from("eb_states").delete().eq("state", state);
      const s = await eb("/sessions", { method: "POST", body: JSON.stringify({ code }) });
      await db.from("eb_sessions").upsert({ session_id: s.session_id, user_id: st.user_id, bank: st.bank, country: st.country, valid_until: s.access?.valid_until ?? null, status: "AUTHORIZED", accounts: s.accounts ?? [] });
      await syncTout({ session: s.session_id });
      // renouvellement : l'ancien accès à la même banque est révoqué (les comptes, déjà rattachés au nouveau, restent)
      const { data: vieux } = await db.from("eb_sessions").select("session_id").eq("user_id", st.user_id).eq("bank", st.bank).neq("session_id", s.session_id);
      for (const v of vieux ?? []) {
        try { await fetch(`${EB}/sessions/${v.session_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${await jwt()}` } }); } catch { /* */ }
        await db.from("comptes").update({ session_id: s.session_id }).eq("session_id", v.session_id);
        await db.from("eb_sessions").delete().eq("session_id", v.session_id);
      }
      return retour("ok");
    }
    if (path === "/sync") { // appel automatique toutes les heures (4 accès par banque et par 24 h au plus), protégé par un jeton gardé en base
      const { data } = await db.from("lumo_conf").select("token").eq("id", 1).single();
      const k = req.headers.get("x-lumo") ?? "";
      if (!k || !data?.token || k !== data.token) return new Response("Accès refusé", { status: 401 });
      return J({ ok: true, msg: await syncTout() });
    }
    return new Response("Lumo", { status: 404 });
  } catch (e) {
    await log(false, `${path} : ${(e as Error).message}`).catch(() => {});
    return path === "/callback" ? retour("erreur") : J({ ok: false, msg: (e as Error).message }, 500);
  }
});
