// ───────────────────────── Shared helpers ─────────────────────────
export interface PlaySource {
  label: string;
  url: string;
  hls?: boolean;
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

const PROXIES = [
  // our own Vercel edge function first (same-origin, no CORS problems), public proxies as a last resort
  (u: string) => `/api/proxy?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

async function timedFetch(u: string, ms = 20000): Promise<Response> {
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

export const streamUrl = (u: string) => `/api/stream?url=${encodeURIComponent(u)}`;

async function request(url: string, proxy: boolean, as: "json" | "text") {
  const host = new URL(url).host;
  const attempts: string[] = [];
  if (!(proxy && proxyHosts.has(host))) attempts.push(url);
  if (proxy) PROXIES.forEach((p) => attempts.push(p(url)));
  let lastErr: unknown = new Error("Network error");
  for (let i = 0; i < attempts.length; i++) {
    try {
      const r = await timedFetch(attempts[i], i === 0 ? 8000 : 25000);
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
const OTT = "https://mukul-ott.ai.studio";

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
  const d = await getData<any>(`${OTT}/api/categories`, { proxy: true, ttl: 30 * 60_000 });
  return d.categories || [];
}

export async function ottList(page: number, category?: string): Promise<OttItem[]> {
  const q = `page=${page}` + (category ? `&category=${encodeURIComponent(category)}` : "");
  const d = await getData<any>(`${OTT}/api/movies?${q}`, { proxy: true });
  return (d.items || []).map(normOtt);
}

export async function ottSearch(q: string): Promise<OttItem[]> {
  const d = await getData<any>(`${OTT}/api/search?q=${encodeURIComponent(q)}`, { proxy: true });
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
  const d = await getData<any>(`${OTT}/api/movie/${slug}`, { proxy: true, ttl: 2 * 60_000 });
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

export const ottAbs = (p?: string) => (!p ? "" : p.startsWith("http") ? p : OTT + p);

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
const CTG = "https://www.ctghall.com";

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
export const ctgVideo = (u?: string) => (u ? CTG + encodeURI(u) : "");

export async function ctgList(lib: number, page: number) {
  const f = "id,title,original_title,year,poster_path,release_date,rating,online_rating";
  const d = await getData<any>(
    `${CTG}/api/movies?library=${lib}&page=${page}&limit=30&fields=${f}&sort=createdAt&sort_order=DESC`
  );
  return { data: (d.data || []) as CtgMovie[], pages: (d.pages || 1) as number };
}

export async function ctgSearch(q: string): Promise<CtgMovie[]> {
  const d = await getData<any>(`${CTG}/api/search?search=${encodeURIComponent(q)}`);
  const arr = (Array.isArray(d) ? d : d.data || []) as any[];
  return arr.filter((x) => x.url && (!x.type || x.type === "movie")).slice(0, 60);
}

export const ctgDetail = (id: number) => getData<CtgMovie>(`${CTG}/api/movies/${id}`, { ttl: 120_000 });

// ───────────────────────── Bongo ─────────────────────────
const BONGO_SCRAPE = "https://hamyra-api.mdibrahimkhalil516.workers.dev/bongo/scrape";
const BONGO_HLS = [
  "https://hamyra-api.aininjaibrahim.workers.dev/bongo/hls",
  "https://hamyra-api.mdibrahimkhalil516.workers.dev/bongo/hls",
];

export interface BongoItem {
  id: string;
  title: string;
  thumbnail: string;
  landscape?: string;
  category?: string;
  contentType?: string;
  watchUrl?: string;
  premium?: boolean;
}
export interface BongoCategory {
  key: string;
  title: string;
  items: BongoItem[];
}

export async function bongoScrape(): Promise<BongoCategory[]> {
  const d = await getData<any>(BONGO_SCRAPE, { ttl: 10 * 60_000 });
  const cats = (d.categories || []) as BongoCategory[];
  return cats.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, title: decode(i.title) })) }));
}

export const bongoSources = (id: string): PlaySource[] =>
  BONGO_HLS.map((b, i) => ({ label: `সার্ভার ${i + 1}`, url: `${b}?id=${id}`, hls: true }));

// ───────────────────────── Sports ─────────────────────────
export interface SportMatch {
  id: string;
  title: string;
  image?: string;
  status: "live" | "upcoming" | string;
  sport?: string;
  league?: string;
  start?: string;
  servers: PlaySource[];
}
export interface Highlight {
  id: string;
  title: string;
  rail: string;
  thumbnail: string;
  sources: PlaySource[];
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
  const d = await getData<any>("https://mukulsport1.vercel.app/api/matches", { ttl: 30_000 });
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
  const d = await getData<any>("https://mukulsport.vercel.app/api/feed/streams.json", { ttl: 30_000 });
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

export interface SportsData {
  matches: SportMatch[];
  highlights: Highlight[];
  highlightsError: boolean;
}

export async function loadSports(): Promise<SportsData> {
  const [a, b] = await Promise.allSettled([sportsMatches(), sportsFeed()]);
  if (a.status === "rejected" && b.status === "rejected") throw a.reason;
  const byKey = new Map<string, SportMatch>();
  [...(a.status === "fulfilled" ? a.value : []), ...(b.status === "fulfilled" ? b.value.matches : [])].forEach((m) => {
    const k = m.title.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, "") + "|" + (m.status === "live" ? "l" : "u");
    const ex = byKey.get(k);
    if (!ex) return void byKey.set(k, { ...m, servers: [...m.servers] });
    m.servers.forEach((sv) => {
      if (!ex.servers.find((e) => e.url === sv.url)) ex.servers.push({ ...sv, label: `সার্ভার ${ex.servers.length + 1}` });
    });
    ex.image = ex.image || m.image;
    ex.league = ex.league || m.league;
    ex.sport = ex.sport || m.sport;
    ex.start = ex.start || m.start;
  });
  const matches = [...byKey.values()];
  return {
    matches,
    highlights: b.status === "fulfilled" ? b.value.highlights : [],
    highlightsError: b.status === "rejected",
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
  const t = await getData<string>(`${OTT}/api/iptv/live.m3u`, { proxy: true, as: "text", ttl: 10 * 60_000 });
  return parseM3U(t);
}

// ───────────────────────── Music ─────────────────────────
const MUSIC = "https://music45-api.vercel.app/api";

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
  const d = await getData<any>(`${MUSIC}/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`);
  return (d.data?.results || []).map(normSong).filter((s: Song) => s.urls.length);
}

export async function musicPlaylists(q: string, limit = 20): Promise<PlaylistCard[]> {
  const d = await getData<any>(`${MUSIC}/search/playlists?query=${encodeURIComponent(q)}&limit=${limit}`);
  return (d.data?.results || []).map((p: any) => ({
    id: p.id,
    name: decode(p.name),
    image: img(p.image),
    songCount: p.songCount,
  }));
}

export async function musicPlaylist(id: string) {
  const d = await getData<any>(`${MUSIC}/playlists?id=${id}&page=1&limit=60`);
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

// ───────────────────────── YouTube (Data API v3 via /api/youtube) ─────────────────────────
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

const CLIENT_KEYS = [(import.meta as any).env?.VITE_YT_KEY as string | undefined, "AIzaSyDaP1ZosCkptk4CgfPa4XoPc3aV2CA05z4", "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"].filter(Boolean) as string[];
export const YT_PAGE = 24;

async function ytDirect(q: string, pageToken: string | undefined): Promise<YtPage> {
  const call = async (path: string, params: Record<string, string>) => {
    let msg = "";
    for (const key of CLIENT_KEYS) {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`, {
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
  try {
    const r = await fetch(`/api/youtube?${qs}`);
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d?.error || `HTTP ${r.status}`);
    if (Array.isArray(d.items)) return d as YtPage;
    throw new Error("অপ্রত্যাশিত রেসপন্স");
  } catch (e: any) {
    first = e?.message || "server error";
  }
  try {
    return await ytDirect(q, pageToken);
  } catch (e: any) {
    throw new Error(`${e?.message || "YouTube API error"} (সার্ভার: ${first})`);
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
