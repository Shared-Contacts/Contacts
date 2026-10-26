// ============================================================
// read-recipe
//
// Paste this into the Supabase dashboard: Edge Functions > Deploy
// a new function > name it exactly  read-recipe
//
// Leave "Verify JWT" switched ON (the usual setting). Only people
// signed in to the app can use it. It needs no secrets.
//
// What it does: the app sends it the address of a recipe page. It
// fetches the page and reads the recipe card that most recipe sites
// put in for Google (the "schema.org Recipe"): title, photo,
// ingredients, method, times, serves, video. If the page has no
// card it still sends back the page's title and picture.
//
// The app cannot do this itself, because a web page is not allowed
// to read other websites. Nothing is stored here.
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

// Only ordinary public web pages: never this computer, or a private network.
function safeUrl(s: string): URL | null {
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return null;   // bare numbers
  return u;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½",
  frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—", rsquo: "’",
  lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", eacute: "é", egrave: "è",
};
function clean(v: unknown): string {
  return String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

// "PT1H20M" -> 80
function minutes(v: unknown): number | null {
  const m = String(v ?? "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  const n = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return n > 0 && n < 10000 ? n : null;
}

function serves(v: unknown): number | null {
  const list = Array.isArray(v) ? v : [v];
  for (const x of list) {
    const m = String(x ?? "").match(/\d+/);
    if (m) { const n = Number(m[0]); if (n >= 1 && n <= 100) return n; }
  }
  return null;
}

function imageOf(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) { const s = imageOf(x); if (s) return s; }
    return "";
  }
  const o = v as Record<string, unknown>;
  return imageOf(o.url || o.contentUrl);
}

function videoOf(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return videoOf(v[0]);
  if (typeof v === "string") return v;
  const o = v as Record<string, unknown>;
  return String(o.contentUrl || o.embedUrl || o.url || "");
}

type Step = { head?: string; text?: string };
function steps(v: unknown, out: Step[] = []): Step[] {
  if (!v) return out;
  if (typeof v === "string") {
    // One long string: split it at line breaks, or failing that at full stops.
    const parts = v.includes("\n") ? v.split(/\n+/) : [v];
    parts.map(clean).filter(Boolean).forEach((t) => out.push({ text: t }));
    return out;
  }
  if (Array.isArray(v)) { v.forEach((x) => steps(x, out)); return out; }
  const o = v as Record<string, unknown>;
  const type = String(o["@type"] || "");
  if (/HowToSection/i.test(type)) {
    const h = clean(o.name);
    if (h) out.push({ head: h });
    return steps(o.itemListElement, out);
  }
  const t = clean(o.text || o.name);
  if (t) out.push({ text: t });
  return out;
}

const isRecipe = (o: any) =>
  o && typeof o === "object" &&
  [].concat(o["@type"] || []).some((t: string) => /^(schema:)?Recipe$/i.test(String(t)));

// The recipe can be the whole block, one of a list, inside @graph or
// hanging off the page as mainEntity.
function findRecipe(node: any, depth = 0): any {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (isRecipe(node)) return node;
  const kids = Array.isArray(node) ? node
    : [node["@graph"], node.mainEntity, node.mainEntityOfPage, node.itemListElement, node.item]
        .filter(Boolean);
  for (const k of kids) {
    const r = findRecipe(k, depth + 1);
    if (r) return r;
  }
  return null;
}

function meta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']` +
    `|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i");
  const m = html.match(re);
  return clean(m ? (m[1] ?? m[2]) : "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  let asked = "";
  try { asked = String((await req.json()).url || ""); } catch { /* nothing sent */ }
  const url = safeUrl(asked);
  if (!url) return reply({ error: "That is not a web page address." }, 400);

  let html = "";
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(url, {
      signal: ctl.signal, redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!r.ok) return reply({ error: "The website said no (" + r.status + ")." }, 502);
    // Enough of any page to find the recipe card, and no more.
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    while (html.length < 3_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
  } catch {
    return reply({ error: "Could not reach that website." }, 502);
  }

  let recipe: any = null;
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocks) {
    try {
      const json = JSON.parse(b[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim());
      recipe = findRecipe(json);
      if (recipe) break;
    } catch { /* a broken block: try the next */ }
  }

  const site = clean(meta(html, "og:site_name")) || url.hostname.replace(/^www\./, "");
  const pageTitle = meta(html, "og:title") ||
    clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const pageImage = meta(html, "og:image");

  if (!recipe) {
    return reply({ found: false, url: url.href, site, title: pageTitle,
                   image: pageImage, ingredients: [], steps: [] });
  }

  const cats = []
    .concat(recipe.recipeCategory || [], recipe.recipeCuisine || [])
    .flatMap((c: unknown) => String(c).split(","))
    .map(clean).filter(Boolean);

  return reply({
    found: true,
    url: url.href,
    site,
    title: clean(recipe.name) || pageTitle,
    description: clean(recipe.description),
    image: imageOf(recipe.image) || pageImage,
    ingredients: [].concat(recipe.recipeIngredient || recipe.ingredients || [])
      .map(clean).filter(Boolean),
    steps: steps(recipe.recipeInstructions),
    serves: serves(recipe.recipeYield),
    prep_mins: minutes(recipe.prepTime),
    cook_mins: minutes(recipe.cookTime) ??
      (minutes(recipe.totalTime) && !minutes(recipe.prepTime) ? minutes(recipe.totalTime) : null),
    video_url: videoOf(recipe.video),
    categories: [...new Set(cats)],
  });
});
