// Lumo · connexion bancaire via Enable Banking (mode gratuit « comptes perso »)
import { createClient } from "npm:@supabase/supabase-js@2";

const EB = "https://api.enablebanking.com";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const FN = `${SB_URL}/functions/v1/bank`;
const QUOTA = 4; // accès sans l’utilisateur autorisés par la banque (DSP2) par 24 h

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

// ---------- chiffrement : seul l'appareil de l'utilisateur peut relire (clé privée sur son téléphone) ----------
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
type Sealer = { kid: string; key: CryptoKey } | null;
const sealers = new Map<string, Promise<Sealer>>();
function sealerFor(userId: string | null): Promise<Sealer> {
  if (!userId) return Promise.resolve(null);
  if (!sealers.has(userId)) sealers.set(userId, (async () => {
    const { data: k } = await db.from("k_keys").select("rsa_pub").eq("user_id", userId).maybeSingle();
    if (!k?.rsa_pub) return null;
    const pub = await crypto.subtle.importKey("jwk", k.rsa_pub, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    const wrapped = b64(new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, raw)));
    const kid = crypto.randomUUID();
    const { error } = await db.from("eb_wkeys").insert({ id: kid, user_id: userId, wrapped });
    if (error) throw new Error(error.message);
    return { kid, key };
  })());
  return sealers.get(userId)!;
}
async function seal(sl: NonNullable<Sealer>, obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sl.key, new TextEncoder().encode(JSON.stringify(obj))));
  return b64(iv) + "." + b64(ct);
}

// ---------- helpers ----------
const txt = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
async function token() { const { data } = await db.from("lumo_conf").select("token").eq("id", 1).single(); return data?.token as string; }
async function log(ok: boolean, msg: string) { await db.from("eb_sync_log").insert({ ok, msg: msg.slice(0, 900) }); }
const day = (d: Date) => d.toISOString().slice(0, 10);

function txLabel(t: any) {
  const ri = (t.remittance_information ?? []).filter(Boolean).join(" ").trim();
  const cp = (t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name) ?? "";
  return (ri || cp || t.note || "Opération").replace(/\s+/g, " ").slice(0, 140);
}
async function hash(s: string) { const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); return Array.from(d.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join(""); }

async function syncAccount(acc: any, bank: string, sessionId: string, from: string, ph?: Record<string, string>, sl: Sealer = null) {
  let bal: any = null;
  try {
    const b = await eb(`/accounts/${acc.uid}/balances`, { headers: ph ?? {} });
    const L = b.balances ?? [];
    const pref = ["CLBD", "ITBD", "XPCD", "ITAV", "CLAV", "OPBD"];
    const rk = (x: any) => { const i = pref.indexOf(x.balance_type); return i < 0 ? 99 : i; };
    bal = L.slice().sort((x: any, y: any) => rk(x) - rk(y))[0] ?? null;
  } catch (e) { await log(false, `solde ${bank} : ${(e as Error).message}`); }
  const row: any = { uid: acc.uid, session_id: sessionId, bank, name: acc.name ?? acc.product ?? null, iban: acc.account_id?.iban ?? null, currency: acc.currency ?? null, product: acc.product ?? null, cash_type: acc.cash_account_type ?? null, updated_at: new Date().toISOString() };
  if (bal) { row.balance = +bal.balance_amount.amount; row.balance_type = bal.balance_type ?? null; row.balance_at = new Date().toISOString(); }
  if (sl) {
    const { data: prev } = await db.from("eb_accounts").select("enc,kid").eq("uid", acc.uid).maybeSingle();
    const keep = !bal && prev?.enc ? { enc: prev.enc, kid: prev.kid } : null;
    const secret = { name: row.name, iban: row.iban, product: row.product, balance: row.balance ?? null, balance_type: row.balance_type ?? null };
    Object.assign(row, { name: null, iban: null, product: null, balance: null, balance_type: null }, keep ?? { enc: await seal(sl, secret), kid: sl.kid });
  }
  await db.from("eb_accounts").upsert(row);
  let ck: string | null = null, n = 0, guard = 0;
  do {
    const q = new URLSearchParams({ date_from: from });
    if (ck) q.set("continuation_key", ck);
    const r = await eb(`/accounts/${acc.uid}/transactions?${q}`, { headers: ph ?? {} });
    const rows = [];
    for (const [i, t] of (r.transactions ?? []).entries()) {
      if (t.status && t.status !== "BOOK") continue;
      const amt = +t.transaction_amount.amount * (t.credit_debit_indicator === "DBIT" ? -1 : 1);
      const date = t.booking_date ?? t.value_date ?? t.transaction_date;
      const label = txLabel(t);
      const id = acc.uid + ":" + (t.entry_reference || t.transaction_id || (await hash(`${date}|${amt}|${label}|${i}`)));
      if (sl) rows.push({ id, account_uid: acc.uid, bank, date, amount: null, label: null, status: t.status ?? "BOOK", raw: null, enc: await seal(sl, { a: amt, l: label }), kid: sl.kid });
      else rows.push({ id, account_uid: acc.uid, bank, date, amount: amt, label, status: t.status ?? "BOOK", raw: null });
    }
    if (rows.length) { const { error } = await db.from("eb_tx").upsert(rows, { onConflict: "id", ignoreDuplicates: false }); if (error) throw new Error(error.message); n += rows.length; }
    ck = r.continuation_key ?? null;
  } while (ck && ++guard < 40);
  return n;
}

async function syncAll(only?: string, ph?: Record<string, string>, userId?: string) {
  let q = db.from("eb_sessions").select("*").neq("status", "REVOKED");
  if (only) q = q.eq("session_id", only);
  if (userId) q = q.eq("user_id", userId);
  const { data: S } = await q;
  const out: string[] = [];
  for (const s of S ?? []) {
    try {
      if (s.valid_until && new Date(s.valid_until) < new Date()) { await db.from("eb_sessions").update({ status: "EXPIRED" }).eq("session_id", s.session_id); out.push(`${s.bank} : accès expiré, à renouveler`); continue; }
      const calls: number[] = (Array.isArray(s.calls) ? s.calls : []).map((t: string) => new Date(t).getTime()).filter((t: number) => Date.now() - t < 23.5 * 3600e3);
      if (!only && !ph) {
        if (calls.length >= QUOTA) { const next = new Date(Math.min(...calls) + 24 * 3600e3 + 60e3); out.push(`${s.bank} : quota du jour atteint (${QUOTA} synchros / 24 h), prochaine possible vers ${next.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`); continue; }
        if (s.last_sync && Date.now() - new Date(s.last_sync).getTime() < 90 * 60e3) { out.push(`${s.bank} : déjà à jour`); continue; }
        if (s.error && /429/.test(s.error) && s.last_sync && Date.now() - new Date(s.last_sync).getTime() < 4 * 3600e3) { out.push(`${s.bank} : limite de la banque, réessai plus tard`); continue; }
        calls.push(Date.now());
        await db.from("eb_sessions").update({ calls: calls.map((t) => new Date(t).toISOString()) }).eq("session_id", s.session_id);
      }
      const info = await eb(`/sessions/${s.session_id}`);
      if (info.status && info.status !== "AUTHORIZED") { await db.from("eb_sessions").update({ status: info.status }).eq("session_id", s.session_id); out.push(`${s.bank} : ${info.status}`); continue; }
      const from = s.last_sync ? day(new Date(new Date(s.last_sync).getTime() - 10 * 864e5)) : day(new Date(Date.now() - 730 * 864e5));
      let n = 0;
      const sl = await sealerFor(s.user_id ?? null);
      for (const a of s.accounts ?? []) n += await syncAccount(a, s.bank, s.session_id, from, ph, sl);
      await db.from("eb_sessions").update({ last_sync: new Date().toISOString(), status: "AUTHORIZED", error: null }).eq("session_id", s.session_id);
      out.push(`${s.bank} : ${(s.accounts ?? []).length} compte(s), ${n} opération(s)`);
    } catch (e) {
      const raw = (e as Error).message;
      const m = /\b429\b/.test(raw) ? "429 : limite de synchronisation de la banque atteinte (quelques fois par jour). Réessai automatique plus tard." : raw;
      await db.from("eb_sessions").update({ error: m, last_sync: new Date().toISOString() }).eq("session_id", s.session_id);
      out.push(`${s.bank} : erreur — ${m}`);
    }
  }
  const msg = out.join(" · ") || "Aucune banque connectée";
  await log(!out.some((x) => /erreur/.test(x)), msg);
  return msg;
}

// ---------- appli Lumo : routes réservées à l'utilisateur connecté ----------
const ORIGIN_OK = /^(https:\/\/lumo[a-z0-9-]*\.vercel\.app|http:\/\/localhost(:\d+)?|http:\/\/127\.0\.0\.1(:\d+)?)$/;
function cors(req: Request, r: Response) {
  const o = req.headers.get("origin") ?? "";
  if (ORIGIN_OK.test(o)) { r.headers.set("Access-Control-Allow-Origin", o); r.headers.set("Vary", "Origin"); }
  r.headers.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  r.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return r;
}
function psu(h: Headers) {
  const ph: Record<string, string> = {}, ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (ip) ph["Psu-Ip-Address"] = ip;
  for (const [k, n] of [["user-agent", "Psu-User-Agent"], ["accept", "Psu-Accept"], ["accept-language", "Psu-Accept-language"], ["accept-encoding", "Psu-Accept-Encoding"], ["referer", "Psu-Referer"]]) if (h.get(k)) ph[n] = h.get(k)!;
  ph["Psu-Accept-Charset"] = "utf-8";
  return ph["Psu-Ip-Address"] && ph["Psu-User-Agent"] ? ph : undefined;
}
async function mySessions(uid: string) { const { data } = await db.from("eb_sessions").select("*").eq("user_id", uid); return data ?? []; }
async function userRoute(req: Request, path: string): Promise<Response> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: ud } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } } as any;
  const user = ud?.user;
  if (!user) return Response.json({ ok: false, msg: "Connexion requise" }, { status: 401 });
  const uid = user.id as string;
  const body: any = await req.json().catch(() => ({}));
  if (path === "/u/ticket") {
    const kind = body.kind === "live" ? "live" : "go";
    const t = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    await db.from("lumo_tickets").insert({ t, kind, exp: new Date(Date.now() + 15 * 60e3).toISOString(), user_id: uid });
    return Response.json({ ok: true, t });
  }
  if (path === "/u/sync") {
    const S = await mySessions(uid);
    if (!S.length) return Response.json({ ok: true, msg: "Aucune banque connectée" });
    if (S.every((x: any) => x.last_sync && Date.now() - new Date(x.last_sync).getTime() < 120e3)) return Response.json({ ok: true, msg: "Déjà à jour" });
    const msg = await syncAll(undefined, psu(req.headers), uid);
    return Response.json({ ok: !/erreur/.test(msg), msg });
  }
  if (path === "/u/banks") {
    const { count } = await db.from("eb_banks").select("name", { count: "exact", head: true }).eq("country", "FR");
    if (!count) {
      const r = await eb(`/aspsps?country=FR&psu_type=personal`);
      const rows = (r.aspsps ?? []).map((a: any) => ({ name: a.name, country: "FR", max_days: a.maximum_consent_validity ? Math.floor(a.maximum_consent_validity / 86400) : null, logo: a.logo ?? null, psu_headers: a.required_psu_headers ?? null, updated_at: new Date().toISOString() }));
      if (rows.length) await db.from("eb_banks").upsert(rows, { onConflict: "name,country" });
    }
    return Response.json({ ok: true });
  }
  if (path === "/u/revoke") {
    const sid = String(body.sid || "");
    const S = await mySessions(uid);
    if (!S.some((x: any) => x.session_id === sid)) return Response.json({ ok: false, msg: "Banque introuvable" }, { status: 404 });
    try { await fetch(`${EB}/sessions/${sid}`, { method: "DELETE", headers: { Authorization: `Bearer ${await jwt()}` } }); } catch { /* */ }
    const { data: A } = await db.from("eb_accounts").select("uid").eq("session_id", sid);
    const U = (A ?? []).map((a: any) => a.uid);
    if (U.length) await db.from("eb_tx").delete().in("account_uid", U);
    await db.from("eb_accounts").delete().eq("session_id", sid);
    await db.from("eb_sessions").update({ status: "REVOKED", accounts: [] }).eq("session_id", sid);
    return Response.json({ ok: true });
  }
  if (path === "/u/seal") {
    // chiffre les données enregistrées avant l'activation du chiffrement, et efface les copies en clair
    sealers.delete(uid);
    const sl = await sealerFor(uid);
    if (!sl) return Response.json({ ok: false, msg: "Clé de l’appareil absente" }, { status: 400 });
    const S = await mySessions(uid), sids = S.map((x: any) => x.session_id);
    if (!sids.length) return Response.json({ ok: true, n: 0 });
    const { data: A } = await db.from("eb_accounts").select("*").in("session_id", sids);
    for (const a of A ?? []) {
      if (a.enc && a.name == null && a.balance == null) continue;
      const enc = await seal(sl, { name: a.name, iban: a.iban, product: a.product, balance: a.balance == null ? null : +a.balance, balance_type: a.balance_type });
      await db.from("eb_accounts").update({ enc, kid: sl.kid, name: null, iban: null, product: null, balance: null, balance_type: null }).eq("uid", a.uid);
    }
    const U = (A ?? []).map((a: any) => a.uid);
    let n = 0;
    for (let g = 0; g < 100 && U.length; g++) {
      const { data: T } = await db.from("eb_tx").select("id,account_uid,amount,label").in("account_uid", U).is("enc", null).limit(400);
      if (!T || !T.length) break;
      const rows = [];
      for (const t of T) rows.push({ id: t.id, account_uid: t.account_uid, enc: await seal(sl, { a: t.amount == null ? 0 : +t.amount, l: t.label ?? "" }), kid: sl.kid, amount: null, label: null, raw: null });
      const { error } = await db.from("eb_tx").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      n += rows.length;
    }
    if (U.length) await db.from("eb_tx").update({ raw: null }).in("account_uid", U).not("raw", "is", null);
    return Response.json({ ok: true, n });
  }
  if (path === "/u/reseed") {
    // nouvel appareil sans clé de secours : on efface la copie chiffrée et on la récupère à nouveau auprès de la banque
    sealers.delete(uid);
    const S = await mySessions(uid), sids = S.map((x: any) => x.session_id);
    if (sids.length) {
      const { data: A } = await db.from("eb_accounts").select("uid").in("session_id", sids);
      const U = (A ?? []).map((a: any) => a.uid);
      if (U.length) await db.from("eb_tx").delete().in("account_uid", U);
      await db.from("eb_sessions").update({ last_sync: null }).in("session_id", sids);
    }
    await db.from("eb_wkeys").delete().eq("user_id", uid);
    const msg = sids.length ? await syncAll(undefined, psu(req.headers), uid) : "Aucune banque connectée";
    return Response.json({ ok: true, msg });
  }
  if (path === "/u/forget") {
    // supprime définitivement le compte Lumo et toutes ses données
    for (const s of await mySessions(uid)) {
      try { await fetch(`${EB}/sessions/${s.session_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${await jwt()}` } }); } catch { /* */ }
      const { data: A } = await db.from("eb_accounts").select("uid").eq("session_id", s.session_id);
      const U = (A ?? []).map((a: any) => a.uid);
      if (U.length) await db.from("eb_tx").delete().in("account_uid", U);
      await db.from("eb_accounts").delete().eq("session_id", s.session_id);
      await db.from("eb_sessions").delete().eq("session_id", s.session_id);
    }
    await db.from("k_docs").delete().eq("owner", uid);
    await db.auth.admin.deleteUser(uid);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, msg: "Route inconnue" }, { status: 404 });
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const path = u.pathname.replace(/^(\/functions\/v1)?\/bank/, "") || "/";
  let tkOwner: string | null = null, tkUser: string | null = null;
  if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
  if (path.startsWith("/u/")) return cors(req, await userRoute(req, path).catch(async (e) => { await log(false, `${path} : ${(e as Error).message}`).catch(() => {}); return Response.json({ ok: false, msg: (e as Error).message }, { status: 500 }); }));
  try {
    if (path === "/callback") {
      const code = u.searchParams.get("code"), state = u.searchParams.get("state") ?? "";
      if (u.searchParams.get("error")) return txt(`Connexion annulée.\n\n${u.searchParams.get("error_description") || u.searchParams.get("error") || ""}\n\nFerme cette page et réessaie depuis Lumo.`);
      const { data: st } = await db.from("eb_states").select("*").eq("state", state).maybeSingle();
      const stUser = st?.user_id ?? null;
      if (!st || !code || (st.created_at && Date.now() - new Date(st.created_at).getTime() > 45 * 60e3)) return txt("Lien expiré. Recommence depuis Lumo.", 400);
      await db.from("eb_states").delete().eq("state", state);
      const s = await eb("/sessions", { method: "POST", body: JSON.stringify({ code }) });
      await db.from("eb_sessions").upsert({ session_id: s.session_id, bank: st.bank, country: st.country, valid_until: s.access?.valid_until ?? null, status: "AUTHORIZED", accounts: s.accounts ?? [], ...(st.owner ? { owner: st.owner } : {}), ...(stUser ? { user_id: stUser } : {}) });
      const msg = await syncAll(s.session_id);
      return txt(`✓ ${st.bank} est connectée à Lumo.\n\n${msg}\n\nTu peux fermer cette page et retourner dans Lumo : touche « Synchroniser mes banques ».`);
    }

    // liens ouverts dans le navigateur (/go, /live) : ticket à usage unique, valable 15 min — le jeton principal ne circule jamais dans une URL
    if (path === "/go" || path === "/live") {
      const t = u.searchParams.get("t") ?? "";
      const { data: tk } = t ? await db.from("lumo_tickets").select("*").eq("t", t).maybeSingle() : { data: null };
      if (!tk || tk.used || new Date(tk.exp).getTime() < Date.now() || tk.kind !== path.slice(1)) return txt("Lien expiré ou déjà utilisé. Recommence depuis Lumo.", 401);
      await db.from("lumo_tickets").update({ used: true }).eq("t", t);
      tkOwner = tk.owner ?? null;
      tkUser = tk.user_id ?? null;
    } else {
      const k = req.headers.get("x-lumo") ?? "";
      const tok = await token();
      if (!k || !tok || k !== tok) return new Response("Accès refusé", { status: 401 });
    }

    if (path === "/sync") return Response.json({ ok: true, msg: await syncAll() });

    if (path === "/revoke") {
      const b: any = await req.json().catch(() => ({}));
      const sid = String(b.sid || "");
      if (!sid) return Response.json({ ok: false }, { status: 400 });
      try { await fetch(`${EB}/sessions/${sid}`, { method: "DELETE", headers: { Authorization: `Bearer ${await jwt()}` } }); } catch { /* */ }
      await db.from("eb_sessions").update({ status: "REVOKED" }).eq("session_id", sid);
      await db.from("eb_accounts").delete().eq("session_id", sid);
      await log(true, "déconnexion d’une banque");
      return Response.json({ ok: true });
    }

    if (path === "/live") {
      // synchro « en direct » : ouverte par toi dans ton navigateur, la banque sait que tu es présent (pas de quota)
      const h = req.headers, ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
      const ph: Record<string, string> = {};
      if (ip) ph["Psu-Ip-Address"] = ip;
      if (h.get("user-agent")) ph["Psu-User-Agent"] = h.get("user-agent")!;
      if (h.get("accept")) ph["Psu-Accept"] = h.get("accept")!;
      if (h.get("accept-language")) ph["Psu-Accept-language"] = h.get("accept-language")!;
      if (h.get("accept-encoding")) ph["Psu-Accept-Encoding"] = h.get("accept-encoding")!;
      ph["Psu-Accept-Charset"] = "utf-8";
      if (h.get("referer")) ph["Psu-Referer"] = h.get("referer")!;
      if (!ph["Psu-Ip-Address"] || !ph["Psu-User-Agent"]) return txt("Ouvre ce lien depuis ton navigateur (Safari) pour une synchro en direct.", 400);
      const { data: S2 } = await db.from("eb_sessions").select("session_id,last_sync").neq("status", "REVOKED");
      const recent = (S2 ?? []).every((x: any) => x.last_sync && Date.now() - new Date(x.last_sync).getTime() < 60e3);
      const msg = recent ? "Déjà synchronisé il y a moins d’une minute." : await syncAll(undefined, ph, tkUser ?? undefined);
      return txt(`✓ Synchro en direct terminée.\n\n${msg}\n\nRetourne dans Lumo : tes opérations arrivent à l’ouverture (ou touche « Synchroniser mes banques »).`);
    }

    if (path === "/banks") {
      const country = (u.searchParams.get("c") || "FR").toUpperCase();
      const r = await eb(`/aspsps?country=${country}&psu_type=personal`);
      const rows = (r.aspsps ?? []).map((a: any) => ({ name: a.name, country, max_days: a.maximum_consent_validity ? Math.floor(a.maximum_consent_validity / 86400) : null, logo: a.logo ?? null, psu_headers: a.required_psu_headers ?? null, updated_at: new Date().toISOString() }));
      if (rows.length) await db.from("eb_banks").upsert(rows, { onConflict: "name,country" });
      await log(true, `banques : ${rows.length}`);
      return Response.json({ ok: true, n: rows.length });
    }

    if (path === "/go") {
      const bank = u.searchParams.get("bank") ?? "", country = (u.searchParams.get("c") || "FR").toUpperCase();
      const state = crypto.randomUUID();
      await db.from("eb_states").insert({ state, bank, country, owner: tkOwner, user_id: tkUser });
      const { data: bk } = await db.from("eb_banks").select("max_days").eq("name", bank).eq("country", country).maybeSingle();
      const days = bk?.max_days ? Math.max(1, bk.max_days) : 90;
      const valid = new Date(Date.now() + Math.min(days, 180) * 864e5 - 60e3).toISOString();
      const r = await eb("/auth", { method: "POST", body: JSON.stringify({ access: { valid_until: valid }, aspsp: { name: bank, country }, state, redirect_url: `${FN}/callback`, psu_type: "personal", language: "fr" }) });
      return Response.redirect(r.url, 302);
    }

    if (path === "/status") {
      const { data } = await db.from("eb_sessions").select("bank,valid_until,status,last_sync,error");
      return Response.json({ ok: true, sessions: data });
    }
    return new Response("Lumo bank", { status: 404 });
  } catch (e) {
    const m = (e as Error).message;
    await log(false, `${path} : ${m}`).catch(() => {});
    if (path === "/sync" || path === "/banks" || path === "/status") return Response.json({ ok: false, msg: m }, { status: 500 });
    return txt(`Oups : ${m}\n\nFerme cette page et réessaie depuis Lumo.`, 500);
  }
});
