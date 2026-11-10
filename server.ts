import express, { Request, Response } from "express";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
const PORT = 3000;
const HOST = "0.0.0.0";

const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

const ALLOWED_PROXY_PATTERNS = [
  /^mukul-ott\.ai\.studio$/,
  /(^|\.)ctghall\.com$/,
  /\.workers\.dev$/,
  /^mukulsport1?\.vercel\.app$/,
  /^music45-api\.vercel\.app$/,
  /^api\.allorigins\.win$/,
  /^corsproxy\.io$/,
  /^image\.tmdb\.org$/,
  /(^|\.)elochkaigolochla\.com$/,
  /(^|\.)huljapulja\.site$/,
  /(^|\.)hunts439kow\.com$/,
  /(^|\.)youtubei\.googleapis\.com$/,
  /(^|\.)googlevideo\.com$/,
];

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.startsWith("[") || h.includes(":")) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function parseTarget(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (isPrivateHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

const proxied = (abs: string) => `/api/stream?url=${encodeURIComponent(abs)}`;

function rewritePlaylist(text: string, base: string): string {
  const abs = (u: string) => new URL(u, base).toString();
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, u) => {
          try {
            return `URI="${proxied(abs(u))}"`;
          } catch {
            return _m;
          }
        });
      }
      try {
        return proxied(abs(t));
      } catch {
        return line;
      }
    })
    .join("\n");
}

// YouTube integration
const FALLBACK_KEYS = [
  "AIzaSyDCU8hByM-4DrUqRUYnGn-3llEO78bcxq8",
  "AIzaSyDaP1ZosCkptk4CgfPa4XoPc3aV2CA05z4",
  "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
];
let goodKey = 0;
const YT_API = "https://www.googleapis.com/youtube/v3";

function parseDurationSeconds(iso?: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

async function callYt(
  pathName: string,
  params: Record<string, string>,
  keys: string[],
  origin: string
): Promise<any> {
  let last: any;
  for (let n = 0; n < keys.length; n++) {
    const i = (goodKey + n) % keys.length;
    const qs = new URLSearchParams({ ...params, key: keys[i] });
    const r = await fetch(`${YT_API}/${pathName}?${qs}`, {
      headers: { referer: origin + "/" },
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      goodKey = i;
      return d;
    }
    const err: any = new Error(d?.error?.message || "YouTube API error");
    err.status = r.status;
    last = err;
    if (![400, 403, 429].includes(r.status)) break;
  }
  throw last;
}

const isEmbeddable = (v: any) => v.status?.embeddable !== false;

const shapeYt = (v: any) => ({
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
  duration: parseDurationSeconds(v.contentDetails?.duration),
  views: Number(v.statistics?.viewCount || 0),
});

async function startServer() {
  const app = express();

  // CORS headers for all /api endpoints
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // GET /api/proxy
  app.get("/api/proxy", async (req: Request, res: Response) => {
    const target = parseTarget(req.query.url as string);
    if (!target) {
      res.status(400).json({ error: "bad url" });
      return;
    }
    if (
      !ALLOWED_PROXY_PATTERNS.some((r) => r.test(target.hostname)) &&
      isPrivateHost(target.hostname)
    ) {
      res.status(400).json({ error: "host not allowed" });
      return;
    }

    try {
      const upstream = await fetch(target.toString(), {
        headers: {
          "user-agent": UA,
          accept: "application/json, text/plain, */*",
        },
        redirect: "follow",
      });
      const body = await upstream.text();
      res.status(upstream.status);
      const ct = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
      res.setHeader("content-type", ct);
      res.setHeader(
        "cache-control",
        upstream.ok ? "public, s-maxage=30, stale-while-revalidate=120" : "no-store"
      );
      res.send(body);
    } catch (e: any) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // GET/HEAD /api/stream
  app.all("/api/stream", async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).json({ error: "method" });
      return;
    }
    const target = parseTarget(req.query.url as string);
    if (!target) {
      res.status(400).json({ error: "bad url" });
      return;
    }

    const headers: Record<string, string> = {
      "user-agent": UA,
      accept: "*/*",
    };
    const range = req.headers.range;
    if (range) headers.range = range;

    try {
      const upstream = await fetch(target.toString(), {
        method: req.method,
        headers,
        redirect: "follow",
      });

      const ct = upstream.headers.get("content-type") || "";
      const isPlaylist =
        /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(target.pathname + target.search);

      if (isPlaylist && upstream.ok) {
        const text = await upstream.text();
        if (text.trimStart().startsWith("#EXTM3U")) {
          res.status(200);
          res.setHeader("content-type", "application/vnd.apple.mpegurl");
          res.setHeader("cache-control", "no-store");
          res.send(rewritePlaylist(text, upstream.url || target.toString()));
          return;
        }
        res.status(upstream.status);
        res.setHeader("content-type", ct || "text/plain");
        res.send(text);
        return;
      }

      res.status(upstream.status);
      for (const h of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
        "last-modified",
      ]) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }

      const ctype = res.getHeader("content-type") || "";
      if (
        /\.mkv(\?|$)/i.test(target.pathname + target.search) ||
        /matroska|octet-stream/i.test(String(ctype))
      ) {
        if (!/\.(mp4|m4v|webm|mov)(\?|$)/i.test(target.pathname)) {
          res.setHeader("content-type", "video/mp4");
        }
      }
      if (!res.hasHeader("accept-ranges")) {
        res.setHeader("accept-ranges", "bytes");
      }
      res.setHeader("cache-control", "no-store");

      if (req.method === "HEAD" || !upstream.body) {
        res.end();
        return;
      }

      const nodeReadable = Readable.fromWeb(upstream.body as any);
      nodeReadable.pipe(res);
    } catch (e: any) {
      if (!res.headersSent) {
        res.status(502).json({ error: String(e?.message || e) });
      }
    }
  });

  // GET /api/youtube
  app.get("/api/youtube", async (req: Request, res: Response) => {
    const envKeys = (process.env.YOUTUBE_API_KEY || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const keys = [...envKeys, ...FALLBACK_KEYS.filter((k) => !envKeys.includes(k))];
    const region = (req.query.region as string) || "BD";
    const pageToken = (req.query.pageToken as string) || undefined;
    const q = ((req.query.q as string) || "").trim();
    const origin = `${req.protocol}://${req.get("host") || "localhost:3000"}`;

    try {
      let ids: string[] = [];
      let next: string | null = null;
      if (q) {
        const s = await callYt(
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
          keys,
          origin
        );
        ids = s.items?.map((i: any) => i.id?.videoId).filter(Boolean) || [];
        next = s.nextPageToken || null;
      } else {
        const t = await callYt(
          "videos",
          {
            part: "snippet,contentDetails,statistics,status",
            chart: "mostPopular",
            maxResults: "24",
            regionCode: region,
            ...(pageToken ? { pageToken } : {}),
          },
          keys,
          origin
        );
        res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
        res.json({
          items: t.items?.filter(isEmbeddable).map(shapeYt) || [],
          next: t.nextPageToken || null,
        });
        return;
      }

      if (!ids.length) {
        res.json({ items: [], next });
        return;
      }

      const d = await callYt(
        "videos",
        { part: "snippet,contentDetails,statistics,status", id: ids.join(",") },
        keys,
        origin
      );
      const byId = new Map(d.items?.filter(isEmbeddable).map((v: any) => [v.id, shapeYt(v)]) || []);
      res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json({
        items: ids.map((i) => byId.get(i)).filter(Boolean),
        next,
      });
    } catch (e: any) {
      res.status(e?.status || 502).json({ error: String(e?.message || e) });
    }
  });

  // GET /api/youtubei/player (InnerTube Player API gateway)
  app.get("/api/youtubei/player", async (req: Request, res: Response) => {
    const videoId = ((req.query.id as string) || "").trim();
    if (!videoId) {
      res.status(400).json({ error: "videoId is required" });
      return;
    }
    const key = "AIzaSyDCU8hByM-4DrUqRUYnGn-3llEO78bcxq8";
    const ytUrl = `https://youtubei.googleapis.com/youtubei/v1/player?key=${key}`;

    const clientConfigs = [
      { clientName: "ANDROID_VR", clientVersion: "1.60.19" },
      { clientName: "WEB", clientVersion: "2.20240313.01.00", hl: "en", gl: "US" },
      { clientName: "MWEB", clientVersion: "2.20240313.01.00" },
    ];

    let lastError: any = null;
    for (const client of clientConfigs) {
      try {
        const response = await fetch(ytUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
          },
          body: JSON.stringify({
            context: { client },
            videoId,
          }),
        });
        const d: any = await response.json();
        const v = d.videoDetails || {};
        const formats = d.streamingData?.formats || [];
        const adaptiveFormats = d.streamingData?.adaptiveFormats || [];
        const hlsManifestUrl = d.streamingData?.hlsManifestUrl;

        if (formats.length || adaptiveFormats.length || hlsManifestUrl || v.title) {
          res.setHeader("cache-control", "public, s-maxage=3600, stale-while-revalidate=7200");
          res.json({
            videoId,
            title: v.title || "",
            author: v.author || "",
            lengthSeconds: Number(v.lengthSeconds || 0),
            shortDescription: v.shortDescription || "",
            thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || "",
            formats,
            adaptiveFormats,
            hlsManifestUrl,
            playabilityStatus: d.playabilityStatus?.status || "OK",
          });
          return;
        }
      } catch (e: any) {
        lastError = e;
      }
    }

    res.status(502).json({ error: lastError?.message || "Could not retrieve streaming data" });
  });

  // GET /api/catalog (Movie catalog gateway)
  app.get("/api/catalog", async (_req: Request, res: Response) => {
    try {
      const response = await fetch("https://mapi.elochkaigolochla.com/api/v1/catalog", {
        headers: { "user-agent": UA, accept: "application/json" },
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // Serve frontend
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
