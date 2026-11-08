// Lumo · Lumi, l’assistant IA : relais vers le modèle, réservé aux utilisateurs connectés, plafonné, rien n'est conservé
import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("LUMO_MODEL") ?? "claude-haiku-5-5";
const DAY_MAX = +(Deno.env.get("LUMO_DAY_MAX") ?? 80);          // questions par jour et par personne
const DAY_TOK = +(Deno.env.get("LUMO_DAY_TOKENS") ?? 400000);   // mots (jetons) par jour et par personne
const ORIGIN_OK = /^(https:\/\/lumo[a-z0-9-]*\.vercel\.app|http:\/\/localhost(:\d+)?|http:\/\/127\.0\.0\.1(:\d+)?)$/;
const cors = (req: Request, r: Response) => { const o = req.headers.get("origin") ?? ""; if (ORIGIN_OK.test(o)) { r.headers.set("Access-Control-Allow-Origin", o); r.headers.set("Vary", "Origin"); } r.headers.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info"); r.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS"); return r; };
const J = (o: unknown, status = 200) => Response.json(o, { status });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = jwt ? await db.auth.getUser(jwt) : ({ data: { user: null } } as any);
    const uid = data?.user?.id;
    if (!uid) return cors(req, J({ code: "not_granted", message: "Connexion requise" }, 401));
    if (!KEY) return cors(req, J({ code: "not_configured", message: "Lumi n’est pas encore activé." }, 503));
    const b: any = await req.json().catch(() => ({}));
    const day = new Date().toISOString().slice(0, 10);
    const { data: u } = await db.from("k_usage").select("n,tok").eq("user_id", uid).eq("day", day).maybeSingle();
    if (u && (u.n >= DAY_MAX || u.tok >= DAY_TOK)) return cors(req, J({ code: "rate_limited", message: "Limite du jour atteinte, reviens demain." }, 429));
    // messages : texte et images (photos de tickets), sans rien enregistrer
    let msgs: any[] = Array.isArray(b.messages) ? b.messages : [{ role: "user", content: String(b.input ?? "") }];
    msgs = msgs.slice(-24).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: typeof m.content === "string" ? m.content.slice(0, 60000) : "" })).filter((m) => m.content);
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") return cors(req, J({ code: "invalid_argument", message: "Question vide" }, 400));
    const imgs = Array.isArray(b.images) ? b.images.slice(0, 3).filter((i: any) => /^image\/(jpeg|png|webp|gif)$/.test(i?.media_type) && typeof i?.data === "string" && i.data.length < 6_000_000) : [];
    if (imgs.length) { const last = msgs[msgs.length - 1]; last.content = [...imgs.map((i: any) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })), { type: "text", text: last.content }]; }
    const tier = b.tier === "complex" ? 2000 : 1200;
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: Math.min(+b.max_tokens || tier, 3000), messages: msgs, ...(b.system ? { system: String(b.system).slice(0, 20000) } : {}) }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return cors(req, J({ code: r.status === 429 ? "rate_limited" : "unavailable", message: j?.error?.message ?? "Lumi est indisponible" }, r.status === 429 ? 429 : 502));
    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const tok = (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0);
    await db.from("k_usage").upsert({ user_id: uid, day, n: (u?.n ?? 0) + 1, tok: (u?.tok ?? 0) + tok });
    return cors(req, J({ text, truncated: j.stop_reason === "max_tokens" }));
  } catch (e) {
    return cors(req, J({ code: "unavailable", message: "Lumi est indisponible" }, 500));
  }
});
