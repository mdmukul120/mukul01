import { getVault } from "virtual:api-vault";

// ───────────────────────── Shared helpers ─────────────────────────
export interface PlaySource {
  label: string;
  url: string;
  altUrl?: string;
  headers?: Record<string, string>;
  hls?: boolean;
  dash?: boolean;
  clearKey?: string | null;
  noLocalProxy?: boolean;
}

export interface PlayRequest {
  title: string;
  subtitle?: string;
  poster?: string;
  sources: PlaySource[];
  live?: boolean;
  related?: RelatedItem[];
}

export interface RelatedItem {
  key: string;
  title: string;
  sub?: string;
  image?: string;
  live?: boolean;
  open: () => void;
}

export const decode = (s?: string | null): string => {
  if (!s) return "";
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value.replace(/[\u200b\u200c\u200d]/g, "").trim();
};

const cache = new Map<string, { t: number; v: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const proxyHosts = new Set<string>();

export function clearApiCache() {
  cache.clear();
  proxyHosts.clear();
}

export function isNativeStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return false;
  return location.hostname === "localhost" || location.protocol === "capacitor:" || location.protocol === "file:";
}

function getProxies(): ((u: string) => string)[] {
  const v = getVault();
  if (isNativeStandalone()) {
    return [(u: string) => `${v.px1}${encodeURIComponent(u)}`, (u: string) => `${v.px2}${encodeURIComponent(u)}`];
  }
  return [
    (u: string) => `/api/proxy?url=${encodeURIComponent(u)}`,
    (u: string) => `${v.px1}${encodeURIComponent(u)}`,
    (u: string) => `${v.px2}${encodeURIComponent(u)}`,
  ];
}

async function timedFetch(u: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  } finally {
    clearTimeout(timer);
  }
}

export const streamUrl = (u: string, headers?: Record<string, string>) => {
  if (isNativeStandalone()) return u;
  const h = headers && Object.keys(headers).length ? `&h=${encodeURIComponent(JSON.stringify(headers))}` : "";
  return `/api/stream?url=${encodeURIComponent(u)}${h}`;
};

async function request(url: string, proxy: boolean, as: "json" | "text") {
  const host = new URL(url).host;
  const attempts: string[] = [];
  const native = isNativeStandalone();
  if (native || !(proxy && proxyHosts.has(host))) attempts.push(url);
  if (proxy) getProxies().forEach((p) => attempts.push(p(url)));
  let lastErr: unknown = new Error("Network error");
  for (let i = 0; i < attempts.length; i++) {
    try {
      const r = await timedFetch(attempts[i], i === 0 ? (native ? 12000 : 7000) : 15000);
      const data = as === "json" ? await r.json() : await r.text();
      if (attempts[i] !== url) proxyHosts.add(host);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function getData<T>(
  url: string,
  opts: { proxy?: boolean; ttl?: number; as?: "json" | "text" } = {}
): Promise<T> {
  const { proxy = true, ttl = 5 * 60_000, as = "json" } = opts;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v as T;
  const running = inflight.get(url);
  if (running) return running as Promise<T>;
  const p = request(url, proxy, as)
    .then((v) => {
      cache.set(url, { t: Date.now(), v });
      return v as T;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export const isHlsUrl = (u: string) => /\.m3u8|\/hls|hls\?|\/live\?|playlist/i.test(u);

// ───────────────────────── Mukul Plus (OTT) ─────────────────────────
const getOttBase = () => getVault().ott;

export interface OttItem {
  slug: string;
  kind: string;
  title: string;
  year?: number;
  quality_tag?: string;
  poster: string;
  language?: string;
}

export interface OttCategory {
  slug: string;
  name: string;
  kind: string;
  count: number;
  bnName?: string;
}

const normOtt = (i: any): OttItem => ({
  ...i,
  title: decode(i.title),
  quality_tag: decode(i.quality_tag),
  language: decode(i.language),
});

export async function ottCategories(): Promise<OttCategory[]> {
  const d = await getData<any>(`${getOttBase()}/api/categories`, { proxy: true, ttl: 30 * 60_000 });
  return d.categories || [];
}

export async function ottList(page: number, category?: string): Promise<OttItem[]> {
  const q = `page=${page}` + (category ? `&category=${encodeURIComponent(category)}` : "");
  const d = await getData<any>(`${getOttBase()}/api/movies?${q}`, { proxy: true });
  return (d.items || []).map(normOtt);
}

export async function ottSearch(q: string): Promise<OttItem[]> {
  const d = await getData<any>(`${getOttBase()}/api/search?q=${encodeURIComponent(q)}`, { proxy: true });
  return (d.items || []).map(normOtt);
}

export interface OttSource {
  url: string;
  download_url?: string;
  direct_url?: string;
  proxy_url?: string;
  direct_proxy_url?: string;
  quality?: number;
  audio?: string;
  type?: string;
  name?: string;
  provider?: string;
  hevc?: boolean;
}
export interface OttEpisode {
  episodeNumber: number;
  title: string;
  sources: OttSource[];
}
export interface OttDownload {
  gate_path: string;
  quality: string;
  size: string;
  is_zip?: boolean;
  episode?: number | null;
}
export interface OttDetail {
  slug: string;
  kind: string;
  title: string;
  poster: string;
  backdrop?: string;
  screenshots: string[];
  description: string;
  genre?: string;
  language?: string;
  quality?: string;
  resolution?: string;
  released?: string;
  imdb_rating?: string | number | null;
  duration?: string | null;
  cast?: string[];
  watch_sources: OttSource[];
  downloads: OttDownload[];
  season_zips: OttDownload[];
  episodes: OttEpisode[];
  trailers: any[];
}

export async function ottDetail(slug: string): Promise<OttDetail> {
  const d = await getData<any>(`${getOttBase()}/api/movie/${slug}`, { proxy: true, ttl: 2 * 60_000 });
  return {
    ...d,
    title: decode(d.title),
    description: decode(d.description),
    language: decode(d.language),
    genre: decode(d.genre),
    screenshots: d.screenshots || [],
    watch_sources: d.watch_sources || [],
    downloads: d.downloads || [],
    season_zips: d.season_zips || [],
    episodes: d.episodes || [],
    cast: d.cast || [],
    trailers: d.trailers || [],
  };
}

export const ottAbs = (p?: string) => (!p ? "" : p.startsWith("http") ? p : getOttBase() + p);

export const isMkvUrl = (u = "") => /\.mkv(\?|$)|matroska/i.test(decodeURIComponent(u));

/** Browser-friendly sources first: non-MKV, non-HEVC, then lower resolution (loads faster). */
export const bestFirst = (list: OttSource[]): OttSource[] => {
  const score = (s: OttSource) =>
    (isMkvUrl(s.direct_url || s.url) || s.type?.toLowerCase() === "mkv" ? 10 : 0) + (s.hevc ? 5 : 0) + (/ac3|dts|eac3|dd/i.test(s.audio || "") ? 3 : 0);
  return [...list].sort((a, b) => score(a) - score(b));
};

export function ottPlaySources(s: OttSource): PlaySource[] {
  const out: PlaySource[] = [];
  const push = (label: string, url?: string) => {
    if (url && !out.find((o) => o.url === url)) out.push({ label, url });
  };
  push("সরাসরি", s.direct_url || s.url);
  push("প্রক্সি ১", ottAbs(s.proxy_url));
  push("প্রক্সি ২", ottAbs(s.direct_proxy_url));
  return out;
}

// ───────────────────────── CTGHall ─────────────────────────
const getCtgBase = () => getVault().ctg;

export const CTG_LIBS = [
  { id: 1, name: "ইংলিশ" },
  { id: 4, name: "বলিউড" },
  { id: 7, name: "সাউথ ইন্ডিয়ান" },
  { id: 5, name: "এশিয়ান ও এনিমে" },
  { id: 6, name: "ইন্ডিয়ান বাংলা" },
];

export interface CtgMovie {
  id: number;
  title: string;
  year?: number;
  poster_path?: string | null;
  online_rating?: number;
  Library?: { name: string };
  overview?: string;
  genre?: string;
  casts?: string;
  backdrop_path?: string | null;
  release_date?: string | null;
  url?: string;
  tagline?: string;
  trailers?: string;
}

export const ctgTitle = (t?: string) => decode((t || "").replace(/\+/g, " "));
export const ctgImg = (p?: string | null, size = "w342") =>
  p ? `https://image.tmdb.org/t/p/${size}${p}` : "";
export const ctgVideo = (u?: string) => (u ? getCtgBase() + encodeURI(u) : "");

export async function ctgList(lib: number, page: number) {
  const f = "id,title,original_title,year,poster_path,release_date,rating,online_rating";
  const d = await getData<any>(
    `${getCtgBase()}/api/movies?library=${lib}&page=${page}&limit=30&fields=${f}&sort=createdAt&sort_order=DESC`
  );
  return { data: (d.data || []) as CtgMovie[], pages: (d.pages || 1) as number };
}

export async function ctgSearch(q: string): Promise<CtgMovie[]> {
  const d = await getData<any>(`${getCtgBase()}/api/search?search=${encodeURIComponent(q)}`);
  const arr = (Array.isArray(d) ? d : d.data || []) as any[];
  return arr.filter((x) => x.url && (!x.type || x.type === "movie")).slice(0, 60);
}

export const ctgDetail = (id: number) => getData<CtgMovie>(`${getCtgBase()}/api/movies/${id}`, { ttl: 120_000 });

// ───────────────────────── Bongo / Mukul Drama ─────────────────────────
export interface BongoItem {
  id: string;
  title: string;
  thumbnail: string;
  landscape?: string;
  category?: string;
  contentType?: string;
  watchUrl?: string;
  premium?: boolean;
  ytVideo?: YtVideo;
  catalogMovie?: CatalogMovie;
}
export interface BongoCategory {
  key: string;
  title: string;
  items: BongoItem[];
}

export async function bongoScrape(): Promise<BongoCategory[]> {
  const cached = cache.get("mukul_drama_feed");
  if (cached && Date.now() - cached.t < 10 * 60_000) return cached.v as BongoCategory[];

  try {
    const r = await timedFetch(getVault().bongoScrape, 4500);
    const d = await r.json();
    const cats = (d?.categories || []) as BongoCategory[];
    if (cats.some((c) => c.items?.length > 0)) {
      const norm = cats.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, title: decode(i.title) })) }));
      cache.set("mukul_drama_feed", { t: Date.now(), v: norm });
      return norm;
    }
  } catch {
    // Fallback to live Drama & Web Series catalog/YouTube sources when Bongo worker is offline
  }

  const [natokRes, seriesYtRes, teleRes, catRes] = await Promise.allSettled([
    ytList("Bangla New Full Natok Drama"),
    ytList("Bangla Web Series Drama Full"),
    ytList("Bangla Full Telefilm Drama"),
    fetchMovieCatalog(),
  ]);

  const toYtBongo = (items: YtVideo[], catLabel: string, contentType: string): BongoItem[] =>
    items.map((v) => ({
      id: "yt-" + v.id,
      title: decode(v.title),
      thumbnail: v.thumb,
      landscape: v.thumb,
      category: catLabel,
      contentType,
      ytVideo: v,
    }));

  const categories: BongoCategory[] = [];
  if (natokRes.status === "fulfilled" && natokRes.value.items.length) {
    categories.push({
      key: "drama",
      title: "বাংলা নাটক · Mukul Drama",
      items: toYtBongo(natokRes.value.items, "বাংলা নাটক", "DRAMA"),
    });
  }

  const serialItems: BongoItem[] = [];
  if (catRes.status === "fulfilled") {
    const seenIds = new Set<number>();
    catRes.value
      .flatMap((c) => c.movies)
      .filter((m) => m.type === "serial" && m.poster)
      .forEach((m) => {
        if (seenIds.has(m.kinopoisk_id)) return;
        seenIds.add(m.kinopoisk_id);
        serialItems.push({
          id: "cat-" + m.kinopoisk_id,
          title: m.title_en || m.title_ru,
          thumbnail: m.poster,
          landscape: m.poster,
          category: "ওয়েব সিরিজ",
          contentType: "SERIES",
          catalogMovie: m,
        });
      });
  }
  if (seriesYtRes.status === "fulfilled" && seriesYtRes.value.items.length) {
    serialItems.push(...toYtBongo(seriesYtRes.value.items.slice(0, 12), "বাংলা সিরিজ", "SERIES"));
  }
  if (serialItems.length) {
    categories.push({
      key: "series",
      title: "ওয়েব সিরিজ · ড্রামা সিরিজ",
      items: serialItems,
    });
  }

  if (teleRes.status === "fulfilled" && teleRes.value.items.length) {
    categories.push({
      key: "telefilm",
      title: "টেলিফিল্ম",
      items: toYtBongo(teleRes.value.items, "টেলিফিল্ম", "TELEFILM"),
    });
  }

  if (!categories.length) throw new Error("Mukul Drama লোড করা যায়নি");
  cache.set("mukul_drama_feed", { t: Date.now(), v: categories });
  return categories;
}

export const bongoSources = (id: string): PlaySource[] => {
  const v = getVault();
  return [v.bongoHls1, v.bongoHls2].map((b, i) => ({ label: `সার্ভার ${i + 1}`, url: `${b}?id=${id}`, hls: true }));
};

// ───────────────────────── Movie Catalog ─────────────────────────
export interface CatalogPlayer {
  url: string;
  translator: string;
  translator_id: number;
  quality: string;
  source: "m3u8" | "iframe" | string;
  server: number;
}

export interface CatalogMovie {
  kinopoisk_id: number;
  type: "movie" | "serial" | string;
  title_ru: string;
  title_en: string;
  poster: string;
  ratings?: {
    imdb?: { rating: number; votes: number };
    bookmyshow?: { rating: number; votes: number };
    mlab?: { rating: number; votes: number };
  };
  player: CatalogPlayer[];
}

export interface CatalogCategory {
  id: number;
  name: string;
  index: number;
  movies: CatalogMovie[];
  bnName?: string;
}

export const CATALOG_CATEGORY_NAMES: Record<number, string> = {
  22: "জনপ্রিয় মুভি ও সিরিজ",
  4: "নতুন সংযোজিত",
  15: "বলিউড মুভি",
  16: "হলিউড মুভি",
  19: "বলিউড সিরিজ",
  20: "হলিউড সিরিজ",
  21: "অ্যানিমেশন ও কার্টুন",
  25: "অন্যান্য মুভি",
};

export async function fetchMovieCatalog(): Promise<CatalogCategory[]> {
  if (!isNativeStandalone()) {
    try {
      const res = await fetch("/api/catalog");
      if (res.ok) {
        const d = await res.json();
        const list = (d.result?.full || []) as CatalogCategory[];
        if (list.length > 0) {
          return list.map((c) => ({
            ...c,
            bnName: CATALOG_CATEGORY_NAMES[c.id] || c.name,
            movies: (c.movies || []).map((m) => ({
              ...m,
              title_en: decode(m.title_en || m.title_ru),
              title_ru: decode(m.title_ru || m.title_en),
            })),
          }));
        }
      }
    } catch {
      // fallback to getData/proxy
    }
  }

  const d = await getData<any>(getVault().catalog, { proxy: true, ttl: 15 * 60_000 });
  const list = (d?.result?.full || []) as CatalogCategory[];
  return list.map((c) => ({
    ...c,
    bnName: CATALOG_CATEGORY_NAMES[c.id] || c.name,
    movies: (c.movies || []).map((m) => ({
      ...m,
      title_en: decode(m.title_en || m.title_ru),
      title_ru: decode(m.title_ru || m.title_en),
    })),
  }));
}

// ───────────────────────── Sports ─────────────────────────
export interface SportTeam {
  name: string;
  logo?: string;
}

export interface SportMatch {
  id: string;
  title: string;
  image?: string;
  status: "live" | "upcoming" | string;
  statusDetail?: string;
  sport?: string;
  league?: string;
  leagueLogo?: string;
  teamA?: SportTeam;
  teamB?: SportTeam;
  start?: string;
  dhakaTime?: string;
  servers: PlaySource[];
}
export interface Highlight {
  id: string;
  title: string;
  rail: string;
  thumbnail: string;
  sources: PlaySource[];
  ytId?: string;
  ytVideo?: YtVideo;
}

const pickUrl = (s: any): string =>
  typeof s === "string" ? s : s?.url || s?.stream_url || s?.streamUrl || s?.hls || s?.hls_url || s?.src || "";

const toSources = (arr: any, prefix = "সার্ভার"): PlaySource[] => {
  if (!Array.isArray(arr)) return [];
  const out: PlaySource[] = [];
  arr.forEach((s, i) => {
    const url = pickUrl(s);
    if (!url || out.find((o) => o.url === url)) return;
    const label = (typeof s === "object" && (s.name || s.label)) || `${prefix} ${i + 1}`;
    out.push({ label: String(label), url, hls: true });
    const d = typeof s === "object" ? s.directUrl : null;
    if (d && d !== url) out.push({ label: label + " (ডিরেক্ট)", url: d, hls: true });
  });
  return out;
};

function normHighlight(h: any, rail = ""): Highlight | null {
  const urls = [h.stream_hls_url, h.hls_url, h.hls, h.stream_url, h.url, h.raw_hls_url].filter(
    (u): u is string => typeof u === "string" && u.length > 4
  );
  const uniq = [...new Set(urls)];
  if (!uniq.length) return null;
  return {
    id: String(h.id ?? uniq[0]),
    title: decode(h.title || h.name || "হাইলাইটস"),
    rail: decode(h.rail || h.category || h.league || rail) || "হাইলাইটস",
    thumbnail: h.thumbnail || h.image || h.poster || h.hero_image || "",
    sources: uniq.map((u, i) => ({ label: `সার্ভার ${i + 1}`, url: u, hls: true })),
  };
}

function collectHighlights(d: any): Highlight[] {
  const out: Highlight[] = [];
  const seen = new Set<string>();
  const push = (arr: any, rail = "") => {
    if (!Array.isArray(arr)) return;
    arr.forEach((h) => {
      const n = h && normHighlight(h, rail);
      if (!n) return;
      const k = n.id + "|" + n.sources[0].url;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(n);
      }
    });
  };
  push(d?.highlights);
  push(d?.replays);
  push(d?.videos);
  if (Array.isArray(d?.rails)) d.rails.forEach((r: any) => push(r?.items || r?.videos, decode(r?.title || r?.name)));
  return out;
}

export async function sportsMatches(): Promise<SportMatch[]> {
  const d = await getData<any>(getVault().sports1, { ttl: 30_000 });
  return (d.matches || []).map((m: any) => ({
    id: String(m.id),
    title: decode(m.name),
    image: m.image,
    status: String(m.status || "").toLowerCase(),
    sport: m.sport,
    league: m.league,
    start: m.startTime,
    servers: toSources(m.servers),
  }));
}

export async function sportsFeed(): Promise<{ matches: SportMatch[]; highlights: Highlight[] }> {
  const d = await getData<any>(getVault().sports2, { ttl: 30_000 });
  const map = (m: any, status: string): SportMatch => ({
    id: String(m.id),
    title: decode(m.title),
    image: m.hero_image || m.home_team?.logoUrl,
    status,
    sport: m.sport,
    league: m.league,
    start: m.start_time || undefined,
    servers: toSources(m.streams || (m.preview_stream_url ? [m.preview_stream_url] : [])),
  });
  return {
    matches: [...(d.live || []).map((m: any) => map(m, "live")), ...(d.upcoming || []).map((m: any) => map(m, "upcoming"))],
    highlights: collectHighlights(d),
  };
}

export async function sportsMukulLive(): Promise<SportMatch[]> {
  const d = await getData<any>(getVault().sports3, { ttl: 30_000 });
  return (d.matches || []).map((m: any) => {
    const servers: PlaySource[] = [];
    const pushSrv = (srv: PlaySource) => {
      if (srv.url && !servers.find((x) => x.url === srv.url)) servers.push(srv);
    };
    (m.servers || []).forEach((s: any, idx: number) => {
      if (!s || s.type === "token") return;
      const proxy = typeof s.proxyUrl === "string" ? s.proxyUrl.trim() : "";
      const direct = typeof s.directUrl === "string" ? s.directUrl.trim() : "";
      const rawUrl = proxy || direct;
      if (!rawUrl) return;
      const isDash = s.type === "dash" || /\.mpd(\?|$)/i.test(rawUrl) || /\.mpd(\?|$)/i.test(direct);
      const isHls = !isDash && (s.type === "hls" || isHlsUrl(rawUrl) || isHlsUrl(direct));
      const cleanKey = s.clearKey ? String(s.clearKey).replace(/[^0-9a-fA-F:]/g, "") : null;
      const clearKey = cleanKey && cleanKey.includes(":") ? cleanKey : null;
      const baseName = decode(s.name) || `সার্ভার ${idx + 1}`;
      const hdrs: Record<string, string> = {};
      if (s.headers && typeof s.headers === "object") {
        for (const [hk, hv] of Object.entries(s.headers)) {
          if (typeof hv === "string" && hv.trim()) hdrs[hk.toLowerCase()] = hv.trim();
        }
      }
      const primary = proxy || direct;
      const alt = proxy && direct && direct !== proxy ? direct : undefined;
      pushSrv({
        label: baseName,
        url: primary,
        altUrl: alt,
        headers: Object.keys(hdrs).length ? hdrs : undefined,
        hls: isHls,
        dash: isDash,
        clearKey,
      });
    });

    return {
      id: "ml-" + String(m.id),
      title: decode(m.title),
      image: m.image || m.leagueLogo || "",
      status: String(m.status || "").toLowerCase(),
      statusDetail: decode(m.statusDetail || m.statusLabel || ""),
      sport: m.sport,
      league: decode(m.league),
      leagueLogo: m.leagueLogo,
      teamA: m.teamA ? { name: decode(m.teamA.name), logo: m.teamA.logo } : undefined,
      teamB: m.teamB ? { name: decode(m.teamB.name), logo: m.teamB.logo } : undefined,
      start: m.startsAtUtc,
      dhakaTime: decode(m.dhakaTime),
      servers,
    } as SportMatch;
  });
}

async function ytHighlights(): Promise<Highlight[]> {
  try {
    const [cr, fb] = await Promise.allSettled([
      ytList("cricket match highlights"),
      ytList("football match highlights"),
    ]);
    const list: Highlight[] = [];
    const seen = new Set<string>();
    const add = (items: YtVideo[], rail: string) => {
      items.slice(0, 10).forEach((v) => {
        if (!v.id || seen.has(v.id)) return;
        seen.add(v.id);
        list.push({
          id: "yt-" + v.id,
          title: v.title,
          rail,
          thumbnail: v.thumb,
          sources: [{ label: "YouTube", url: v.id }],
          ytId: v.id,
          ytVideo: v,
        });
      });
    };
    if (cr.status === "fulfilled") add(cr.value.items, "ক্রিকেট হাইলাইটস");
    if (fb.status === "fulfilled") add(fb.value.items, "ফুটবল হাইলাইটস");
    return list;
  } catch {
    return [];
  }
}

export interface SportsData {
  matches: SportMatch[];
  highlights: Highlight[];
  highlightsError: boolean;
}

const ABBR: Record<string, string> = {
  afg: "afghanistan",
  zim: "zimbabwe",
  pak: "pakistan",
  sl: "srilanka",
  ban: "bangladesh",
  sa: "southafrica",
  ind: "india",
  aus: "australia",
  eng: "england",
  nz: "newzealand",
  wi: "westindies",
};

function normMatchKey(title: string, status: string): string {
  const words = title
    .toLowerCase()
    .replace(/\b\d+\b/g, "")
    .replace(/[^a-z0-9\u0980-\u09ff\s]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w && w !== "vs" && w !== "v")
    .map((w) => ABBR[w] || w)
    .sort();
  return words.join("") + "|" + (status === "live" ? "l" : "u");
}

export async function loadSports(): Promise<SportsData> {
  const [a, b, c] = await Promise.allSettled([sportsMatches(), sportsFeed(), sportsMukulLive()]);
  if (a.status === "rejected" && b.status === "rejected" && c.status === "rejected") throw c.reason;
  const byKey = new Map<string, SportMatch>();
  [
    ...(c.status === "fulfilled" ? c.value : []),
    ...(b.status === "fulfilled" ? b.value.matches : []),
    ...(a.status === "fulfilled" ? a.value : []),
  ].forEach((m) => {
    const k = normMatchKey(m.title, m.status);
    const ex = byKey.get(k);
    if (!ex) return void byKey.set(k, { ...m, servers: [...m.servers] });
    m.servers.forEach((sv) => {
      if (!ex.servers.find((e) => e.url === sv.url)) ex.servers.push({ ...sv, label: sv.label || `সার্ভার ${ex.servers.length + 1}` });
    });
    ex.image = ex.image || m.image;
    ex.league = ex.league || m.league;
    ex.leagueLogo = ex.leagueLogo || m.leagueLogo;
    ex.teamA = ex.teamA || m.teamA;
    ex.teamB = ex.teamB || m.teamB;
    ex.statusDetail = ex.statusDetail || m.statusDetail;
    ex.dhakaTime = ex.dhakaTime || m.dhakaTime;
    ex.sport = ex.sport || m.sport;
    ex.start = ex.start || m.start;
  });
  const matches = [...byKey.values()];
  let highlights = b.status === "fulfilled" ? b.value.highlights : [];
  if (!highlights.length) {
    highlights = await ytHighlights();
  }
  return {
    matches,
    highlights,
    highlightsError: b.status === "rejected" && highlights.length === 0,
  };
}

export function fmtStart(s?: string) {
  if (!s) return "";
  const d = new Date(s.endsWith("Z") || /\+\d\d:?\d\d$/.test(s) ? s : s + "Z");
  if (isNaN(+d)) return "";
  return d.toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// ───────────────────────── Live TV (M3U) ─────────────────────────
export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const out: Channel[] = [];
  let meta: Partial<Channel> | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      const logo = /tvg-logo="([^"]*)"/.exec(line)?.[1] || "";
      const group = /group-title="([^"]*)"/.exec(line)?.[1] || "Others";
      const name = decode(line.substring(line.lastIndexOf(",") + 1)) || /tvg-name="([^"]*)"/.exec(line)?.[1] || "Channel";
      meta = { name, logo, group };
    } else if (line && !line.startsWith("#") && meta) {
      out.push({ id: String(out.length) + "-" + meta.name, name: meta.name!, logo: meta.logo!, group: meta.group!, url: line });
      meta = null;
    }
  }
  return out;
}

export async function liveChannels(): Promise<Channel[]> {
  const t = await getData<string>(`${getOttBase()}/api/iptv/live.m3u`, { proxy: true, as: "text", ttl: 10 * 60_000 });
  return parseM3U(t);
}

// ───────────────────────── Music ─────────────────────────
const getMusicBase = () => getVault().music;

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  duration: number;
  urls: { quality: string; url: string }[];
}
export interface PlaylistCard {
  id: string;
  name: string;
  image: string;
  songCount?: number;
  description?: string;
}

const img = (arr?: { url: string }[]) => (arr && arr.length ? arr[arr.length - 1].url : "");

export function normSong(s: any): Song {
  const artists = s.artists?.primary?.map((a: any) => a.name).join(", ") || s.primaryArtists || s.singers || "";
  return {
    id: s.id,
    title: decode(s.name || s.title),
    artist: decode(artists),
    album: decode(typeof s.album === "string" ? s.album : s.album?.name),
    image: img(s.image),
    duration: Number(s.duration) || 0,
    urls: s.downloadUrl || [],
  };
}

export function songUrl(s: Song, q = "160kbps"): string {
  return (s.urls.find((u) => u.quality === q) || s.urls[s.urls.length - 1])?.url || "";
}

export async function musicSongs(q: string, limit = 40): Promise<Song[]> {
  const d = await getData<any>(`${getMusicBase()}/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`);
  return (d.data?.results || []).map(normSong).filter((s: Song) => s.urls.length);
}

export async function musicPlaylists(q: string, limit = 20): Promise<PlaylistCard[]> {
  const d = await getData<any>(`${getMusicBase()}/search/playlists?query=${encodeURIComponent(q)}&limit=${limit}`);
  return (d.data?.results || []).map((p: any) => ({
    id: p.id,
    name: decode(p.name),
    image: img(p.image),
    songCount: p.songCount,
  }));
}

export async function musicPlaylist(id: string) {
  const d = await getData<any>(`${getMusicBase()}/playlists?id=${id}&page=1&limit=60`);
  const p = d.data;
  return {
    id: p.id as string,
    name: decode(p.name),
    description: decode(p.description),
    image: img(p.image),
    songs: ((p.songs || []) as any[]).map(normSong).filter((s) => s.urls.length),
  };
}

export const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export async function downloadFile(url: string, name: string): Promise<boolean> {
  const tries = [url, streamUrl(url)];
  for (const u of tries) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const b = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

// ───────────────────────── YouTube (Data API v3 via /api/youtube or vault) ─────────────────────────
export interface YtVideo {
  id: string;
  title: string;
  channel: string;
  thumb: string;
  published?: string;
  duration?: number;
  views?: number;
  live?: boolean;
  desc?: string;
}
export interface YtPage {
  items: YtVideo[];
  next: string | null;
}

export const YT_PAGE = 24;

async function ytDirect(q: string, pageToken: string | undefined): Promise<YtPage> {
  const vlt = getVault();
  const keys = [...(vlt.ytKeys || []), (import.meta as any).env?.VITE_YT_KEY as string | undefined].filter(Boolean) as string[];
  const call = async (path: string, params: Record<string, string | undefined>) => {
    let msg = "";
    for (const key of keys) {
      const cleanParams: Record<string, string> = { key };
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) cleanParams[k] = v;
      }
      const r = await fetch(`${vlt.ytV3}/${path}?${new URLSearchParams(cleanParams)}`, {
        referrerPolicy: "origin",
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return d;
      msg = d?.error?.message || `YouTube API ${r.status}`;
      if (![400, 403, 429].includes(r.status)) break;
    }
    throw new Error(msg);
  };
  const dur = (iso: string) => {
    const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
    return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0;
  };
  const shape = (v: any): YtVideo => ({
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    thumb: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || "",
    published: v.snippet.publishedAt,
    desc: v.snippet.description || "",
    duration: dur(v.contentDetails?.duration),
    views: Number(v.statistics?.viewCount || 0),
    live: v.snippet.liveBroadcastContent === "live",
  });
  const part = "snippet,contentDetails,statistics,status";
  const extra = pageToken ? { pageToken } : {};
  if (!q) {
    const d = await call("videos", { part, chart: "mostPopular", maxResults: String(YT_PAGE), regionCode: "BD", ...extra });
    return { items: d.items.filter((v: any) => v.status?.embeddable !== false).map(shape), next: d.nextPageToken || null };
  }
  const s = await call("search", { part: "snippet", type: "video", maxResults: String(YT_PAGE), q, regionCode: "BD", videoEmbeddable: "true", ...extra });
  const ids = s.items.map((i: any) => i.id.videoId).filter(Boolean).join(",");
  if (!ids) return { items: [], next: null };
  const d = await call("videos", { part, id: ids });
  return { items: d.items.filter((v: any) => v.status?.embeddable !== false).map(shape), next: s.nextPageToken || null };
}

export async function ytList(q: string, pageToken?: string): Promise<YtPage> {
  const qs = new URLSearchParams({ q, region: "BD", ...(pageToken ? { pageToken } : {}) });
  let first = "";
  if (!isNativeStandalone()) {
    try {
      const r = await fetch(`/api/youtube?${qs}`);
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d?.error || `HTTP ${r.status}`);
      if (Array.isArray(d.items)) return d as YtPage;
      throw new Error("অপ্রত্যাশিত রেসপন্স");
    } catch (e: any) {
      first = e?.message || "server error";
    }
  }
  try {
    return await ytDirect(q, pageToken);
  } catch (e: any) {
    throw new Error(`${e?.message || "YouTube API error"}${first ? ` (সার্ভার: ${first})` : ""}`);
  }
}

export function ytIdFromUrl(s: string): string | null {
  const t = s.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = /(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/.exec(t);
  return m ? m[1] : null;
}

export const fmtDuration = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
};

export const fmtViews = (n = 0) =>
  n >= 1e7 ? (n / 1e7).toFixed(1) + " কোটি" : n >= 1e5 ? (n / 1e5).toFixed(1) + " লাখ" : n >= 1e3 ? (n / 1e3).toFixed(1) + " হাজার" : String(n);

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return Math.max(1, Math.floor(d / 60)) + " মিনিট আগে";
  if (d < 86400) return Math.floor(d / 3600) + " ঘণ্টা আগে";
  if (d < 2592000) return Math.floor(d / 86400) + " দিন আগে";
  if (d < 31536000) return Math.floor(d / 2592000) + " মাস আগে";
  return Math.floor(d / 31536000) + " বছর আগে";
}

export interface YtStreamFormat {
  itag: number;
  url?: string;
  mimeType?: string;
  quality?: string;
  qualityLabel?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  audioQuality?: string;
}

export interface YtPlayerData {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  shortDescription?: string;
  thumbnail?: string;
  formats: YtStreamFormat[];
  adaptiveFormats: YtStreamFormat[];
  hlsManifestUrl?: string;
  playabilityStatus?: string;
}

export async function ytInnerTubePlayer(videoId: string): Promise<YtPlayerData> {
  if (!isNativeStandalone()) {
    try {
      const res = await fetch(`/api/youtubei/player?id=${encodeURIComponent(videoId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.formats?.length || data.adaptiveFormats?.length || data.hlsManifestUrl || data.title)) {
          return data as YtPlayerData;
        }
      }
    } catch {
      // fallback to direct InnerTube request
    }
  }

  const vlt = getVault();
  const r = await fetch(`${vlt.ytInner}?key=${vlt.ytKeys[0]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID_VR",
          clientVersion: "1.60.19",
          hl: "en",
          gl: "US",
        },
      },
      videoId,
    }),
  });
  const d = await r.json();
  const v = d.videoDetails || {};
  return {
    videoId,
    title: decode(v.title || "YouTube ভিডিও"),
    author: decode(v.author || ""),
    lengthSeconds: Number(v.lengthSeconds || 0),
    shortDescription: decode(v.shortDescription || ""),
    thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || "",
    formats: d.streamingData?.formats || [],
    adaptiveFormats: d.streamingData?.adaptiveFormats || [],
    hlsManifestUrl: d.streamingData?.hlsManifestUrl,
    playabilityStatus: d.playabilityStatus?.status || "OK",
  };
}

// ───────────────────────── Weather ─────────────────────────
export async function fetchWeatherData<T = any>(q: string): Promise<T> {
  if (!isNativeStandalone()) {
    try {
      const r = await fetch(`/api/wx?q=${encodeURIComponent(q)}`);
      if (r.ok) return (await r.json()) as T;
    } catch {
      // fallback to vault
    }
  }
  const vlt = getVault();
  const r = await fetch(`${vlt.wx}?key=${vlt.wxKey}&q=${encodeURIComponent(q)}&days=3&aqi=yes&alerts=no`);
  if (!r.ok) throw new Error("আবহাওয়ার তথ্য পাওয়া যায়নি");
  return (await r.json()) as T;
}
