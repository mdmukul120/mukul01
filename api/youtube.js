// YouTube Data API v3 gateway. The key stays on the server.
// Set YOUTUBE_API_KEY in the Vercel project settings (recommended).
import { json } from "./_util.js";

export const config = { runtime: "edge" };

// Keys are tried in order; if one is over quota / blocked, the next one is used.
// Best practice: put your keys in Vercel → Environment Variables → YOUTUBE_API_KEY (comma-separated)
// and delete the fallbacks below.
const FALLBACK_KEYS = ["AIzaSyDaP1ZosCkptk4CgfPa4XoPc3aV2CA05z4", "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"];
let goodKey = 0;
const API = "https://www.googleapis.com/youtube/v3";

function seconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

async function call(path, params, keys, origin) {
  let last;
  for (let n = 0; n < keys.length; n++) {
    const i = (goodKey + n) % keys.length;
    const qs = new URLSearchParams({ ...params, key: keys[i] });
    // Referer lets keys restricted to "HTTP referrers" work from the server too.
    const r = await fetch(`${API}/${path}?${qs}`, { headers: { referer: origin + "/" } });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      goodKey = i;
      return d;
    }
    const err = new Error(d?.error?.message || "YouTube API error");
    err.status = r.status;
    last = err;
    // quota / key problems → try the next key; anything else is a real error
    if (![400, 403, 429].includes(r.status)) break;
  }
  throw last;
}

const ok = (v) => v.status?.embeddable !== false;

const shape = (v) => ({
  id: typeof v.id === "string" ? v.id : v.id?.videoId,
  title: v.snippet?.title || "",
  channel: v.snippet?.channelTitle || "",
  thumb:
    v.snippet?.thumbnails?.high?.url ||
    v.snippet?.thumbnails?.medium?.url ||
    v.snippet?.thumbnails?.default?.url ||
    "",
  published: v.snippet?.publishedAt || "",
  desc: v.snippet?.description || "",
  live: v.snippet?.liveBroadcastContent === "live",
  duration: seconds(v.contentDetails?.duration),
  views: Number(v.statistics?.viewCount || 0),
});

export default async function handler(req) {
  const envKeys = ((typeof process !== "undefined" && process.env && process.env.YOUTUBE_API_KEY) || "").split(",").map((k) => k.trim()).filter(Boolean);
  const key = [...envKeys, ...FALLBACK_KEYS.filter((k) => !envKeys.includes(k))];
  const p = new URL(req.url).searchParams;
  const region = p.get("region") || "BD";
  const pageToken = p.get("pageToken") || undefined;
  const q = (p.get("q") || "").trim();
  const origin = new URL(req.url).origin;

  try {
    let ids = [];
    let next = null;
    if (q) {
      const s = await call(
        "search",
        {
          part: "snippet",
          type: "video",
          maxResults: "24",
          q,
          regionCode: region,
          videoEmbeddable: "true",
          safeSearch: "moderate",
          ...(pageToken ? { pageToken } : {}),
        },
        key,
        origin
      );
      ids = s.items.map((i) => i.id.videoId).filter(Boolean);
      next = s.nextPageToken || null;
    } else {
      const t = await call(
        "videos",
        {
          part: "snippet,contentDetails,statistics,status",
          chart: "mostPopular",
          maxResults: "24",
          regionCode: region,
          ...(pageToken ? { pageToken } : {}),
        },
        key,
        origin
      );
      return json({ items: t.items.filter(ok).map(shape), next: t.nextPageToken || null }, 200, "public, s-maxage=300, stale-while-revalidate=600");
    }
    if (!ids.length) return json({ items: [], next });
    const d = await call("videos", { part: "snippet,contentDetails,statistics,status", id: ids.join(",") }, key, origin);
    const byId = new Map(d.items.filter(ok).map((v) => [v.id, shape(v)]));
    return json({ items: ids.map((i) => byId.get(i)).filter(Boolean), next }, 200, "public, s-maxage=300, stale-while-revalidate=600");
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, e.status || 502);
  }
}
