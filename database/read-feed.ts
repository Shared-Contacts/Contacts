// ============================================================
// read-feed
//
// Paste this into the Supabase dashboard: Edge Functions > Deploy
// a new function > Via editor > name it exactly  read-feed
//
// Leave "Verify JWT" switched ON (the usual setting). Only people
// signed in to the app can use it. It needs no secrets.
//
// What it does: MY Podcasts sends it the address of a podcast's
// public list of episodes (its feed) when the podcast's host won't
// let the app read it from the phone. Acast is one: it hosts many
// UK podcasts and gives web apps no permission to read its lists
// (checked 23 Nov 2026 with Half-Arsed History and British Murders).
// This fetches the list and hands back only what the episodes
// screen shows (name, date, number, series, length), so the phone
// downloads far less than the whole feed. It hands back nothing
// else from the page, and nothing is stored here.
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

// Only ordinary public web addresses: never this computer, or a private network.
function safeUrl(s: string): URL | null {
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".")) return null;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") ||
      h.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
  return u;
}

// Text as a phone's own feed reader sees it: CDATA kept as it is, the five
// XML entities and numbered characters turned back into letters, tags dropped.
const XML_ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (m, n) => { try { return String.fromCodePoint(Number(n)); } catch { return m; } })
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return m; } })
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => XML_ENT[n]);
}
function text(inner: string): string {
  let out = "", last = 0;
  for (const m of inner.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) {
    out += decode(inner.slice(last, m.index)) + m[1];
    last = (m.index ?? 0) + m[0].length;
  }
  return (out + decode(inner.slice(last))).trim();
}
// The first <name> inside a block: <title> never matches <itunes:title>.
function tag(block: string, name: string): string {
  const n = name.replace(":", "\\:");
  const m = block.match(new RegExp("<" + n + "(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</" + n + "\\s*>)"));
  return m && m[1] !== undefined ? text(m[1]) : "";
}

type Ep = { t: string; p: string; n: string; s: string; g: string; a?: string; l?: string; dur: string };

// Kept in step with epRead in the app, so an episode's tick code is the same
// however its list was read: the guid, or failing that the audio's address,
// or failing that the episode's page. The page is also kept for a BBC one.
function episodes(xml: string): { title: string; eps: Ep[] } | null {
  xml = xml.replace(/\r\n?/g, "\n");
  const start = xml.search(/<channel[\s>]/);
  if (start < 0) return null;
  const body = xml.slice(start);
  const firstItem = body.search(/<item[\s>]/);
  // The podcast's own name, not its picture's (<image> has a <title> too).
  const head = (firstItem < 0 ? body : body.slice(0, firstItem)).replace(/<image[\s>][\s\S]*?<\/image\s*>/g, "");
  const title = tag(head, "title");
  const eps: Ep[] = [];
  for (const m of body.matchAll(/<item[\s>][\s\S]*?<\/item\s*>/g)) {
    if (eps.length >= 5000) break;
    const it = m[0];
    const enc = it.match(/<enclosure\s[^>]*?\burl\s*=\s*("([^"]*)"|'([^']*)')/);
    const a = enc ? decode(enc[2] ?? enc[3] ?? "") : "";
    const g = tag(it, "guid"), l = tag(it, "link");
    const ep: Ep = { t: tag(it, "title").slice(0, 2000), p: tag(it, "pubDate"),
      n: tag(it, "itunes:episode"), s: tag(it, "itunes:season"), g, dur: tag(it, "itunes:duration") };
    if (!g && a) ep.a = a;
    if ((!g && !a && l) || /bbc\.co\.uk\/programmes\//i.test(l)) ep.l = l;
    eps.push(ep);
  }
  return { title, eps };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  let asked = "";
  try { asked = String((await req.json()).url || ""); } catch { /* nothing sent */ }
  const url = safeUrl(asked);
  if (!url) return reply({ error: "That is not a web address." }, 400);

  let xml = "";
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, {
      signal: ctl.signal, redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
    });
    if (!r.ok) { clearTimeout(timer); return reply({ error: "The podcast's website said no (" + r.status + ")." }, 502); }
    if (r.url && !safeUrl(r.url)) { clearTimeout(timer); return reply({ error: "That is not a web address." }, 400); }
    // The biggest lists are a few megabytes; stop well past that.
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    while (xml.length < 25_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      xml += dec.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    clearTimeout(timer);
  } catch {
    return reply({ error: "Could not reach the podcast's website." }, 502);
  }

  const got = episodes(xml);
  if (!got) return reply({ error: "That is not a podcast's list of episodes." }, 422);
  return reply(got);
});
