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
  /(^|\.)mukullive\.ai\.studio$/,
  /(^|\.)hamyra\.xyz$/,
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

const proxied = (abs: string, hParam?: string) =>
  `/api/stream?url=${encodeURIComponent(abs)}${hParam ? `&h=${encodeURIComponent(hParam)}` : ""}`;

function parseForwardHeaders(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const kl = k.toLowerCase();
      if ((kl === "referer" || kl === "origin" || kl === "user-agent") && typeof v === "string" && v.trim()) {
        out[kl] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

function rewritePlaylist(text: string, base: string, hParam?: string): string {
  const abs = (u: string) => new URL(u, base).toString();
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, u) => {
          try {
            return `URI="${proxied(abs(u), hParam)}"`;
          } catch {
            return _m;
          }
        });
      }
      try {
        return proxied(abs(t), hParam);
      } catch {
        return line;
      }
    })
    .join("\n");
}

function rewriteMpd(xml: string, finalUrl: string, hParam?: string): string {
  const mpdDir = finalUrl.slice(0, finalUrl.lastIndexOf("/") + 1);
  const encodeBase = (dir: string) => {
    const payload = Buffer.from(JSON.stringify({ d: dir, h: hParam || "" }), "utf8").toString("base64url");
    return `/api/dash/${payload}/`;
  };
  if (/<BaseURL[^>]*>([^<]+)<\/BaseURL>/i.test(xml)) {
    return xml.replace(/<BaseURL([^>]*)>([^<]+)<\/BaseURL>/gi, (_m, attrs, u) => {
      try {
        const resolved = new URL(u.trim(), mpdDir).toString();
        const dir = resolved.endsWith("/") ? resolved : resolved.slice(0, resolved.lastIndexOf("/") + 1);
        return `<BaseURL${attrs}>${encodeBase(dir)}</BaseURL>`;
      } catch {
        return `<BaseURL${attrs}>${encodeBase(mpdDir)}</BaseURL>`;
      }
    });
  }
  return xml.replace(/(<MPD\b[^>]*>)/i, `$1<BaseURL>${encodeBase(mpdDir)}</BaseURL>`);
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
  app.disable("x-powered-by");

  const rateMap = new Map<string, number[]>();
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), payment=()");
    next();
  });

  // CORS + sliding-window rate limit for all /api endpoints
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || "anon";
    const now = Date.now();
    const hits = (rateMap.get(ip) || []).filter((t) => now - t < 15_000);
    if (hits.length > 180) {
      res.status(429).json({ error: "too many requests" });
      return;
    }
    hits.push(now);
    rateMap.set(ip, hits);
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

  async function pipeStreamTarget(target: URL, hParam: string | undefined, req: Request, res: Response) {
    const fwd = parseForwardHeaders(hParam);
    const headers: Record<string, string> = {
      "user-agent": fwd["user-agent"] || UA,
      accept: "*/*",
    };
    if (fwd.referer) headers.referer = fwd.referer;
    if (fwd.origin) headers.origin = fwd.origin;
    const range = req.headers.range;
    if (range) headers.range = range;

    try {
      const upstream = await fetch(target.toString(), {
        method: req.method,
        headers,
        redirect: "follow",
      });

      const ct = upstream.headers.get("content-type") || "";
      const pathAndQuery = target.pathname + target.search;
      const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(pathAndQuery);
      const isMpd = /dash\+xml/i.test(ct) || /\.mpd(\?|$)/i.test(pathAndQuery);

      if (isPlaylist && upstream.ok) {
        const text = await upstream.text();
        if (text.trimStart().startsWith("#EXTM3U")) {
          res.status(200);
          res.setHeader("content-type", "application/vnd.apple.mpegurl");
          res.setHeader("cache-control", "no-store");
          res.send(rewritePlaylist(text, upstream.url || target.toString(), hParam));
          return;
        }
        res.status(upstream.status);
        res.setHeader("content-type", ct || "text/plain");
        res.send(text);
        return;
      }

      if (isMpd && upstream.ok) {
        const xml = await upstream.text();
        if (/<MPD\b/i.test(xml)) {
          res.status(200);
          res.setHeader("content-type", "application/dash+xml");
          res.setHeader("cache-control", "no-store");
          res.send(rewriteMpd(xml, upstream.url || target.toString(), hParam));
          return;
        }
        res.status(upstream.status);
        res.setHeader("content-type", ct || "application/xml");
        res.send(xml);
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
        /\.mkv(\?|$)/i.test(pathAndQuery) ||
        /matroska|octet-stream/i.test(String(ctype))
      ) {
        if (!/\.(mp4|m4v|webm|mov|m4s|ts)(\?|$)/i.test(target.pathname)) {
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
  }

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
    const hParam = typeof req.query.h === "string" && req.query.h.trim() ? req.query.h.trim() : undefined;
    await pipeStreamTarget(target, hParam, req, res);
  });

  // GET/HEAD /api/dash/:payload/... (DASH init/media segment proxy)
  app.use("/api/dash/:payload", async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).json({ error: "method" });
      return;
    }
    try {
      const payloadParam = Array.isArray(req.params.payload) ? req.params.payload[0] : req.params.payload;
      const raw = Buffer.from(String(payloadParam || ""), "base64url").toString("utf8");
      const meta = JSON.parse(raw) as { d?: string; h?: string };
      const rel = req.url.replace(/^\/+/, "");
      const target = parseTarget(meta.d ? new URL(rel, meta.d).toString() : null);
      if (!target) {
        res.status(400).json({ error: "bad dash target" });
        return;
      }
      await pipeStreamTarget(target, meta.h || undefined, req, res);
    } catch {
      res.status(400).json({ error: "bad dash payload" });
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

  // GET /api/wx (Weather gateway)
  app.get("/api/wx", async (req: Request, res: Response) => {
    const q = ((req.query.q as string) || "Dhaka").trim();
    const key = process.env.WEATHER_API_KEY || "241e16270ce941668ad100110231508";
    try {
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${encodeURIComponent(q)}&days=3&aqi=yes&alerts=no`;
      const response = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(response.status).json(data);
        return;
      }
      res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // GET /api/edge/* (Authenticated Edge gateway for Cricfy, Tapmad Entertainment & Web Feed)
  let edgeTokenCache: { token: string; exp: number } | null = null;
  async function getEdgeToken(): Promise<string> {
    if (process.env.EDGE_AUTH_TOKEN?.trim()) return process.env.EDGE_AUTH_TOKEN.trim();
    if (edgeTokenCache && Date.now() < edgeTokenCache.exp) return edgeTokenCache.token;
    for (const authUrl of [
      "https://hamyra-api.aininjaibrahim.workers.dev/auth/token",
      "https://edge.hamyra.xyz/auth/token",
    ]) {
      for (const method of ["GET", "POST"] as const) {
        try {
          const r = await fetch(authUrl, {
            method,
            headers: { "user-agent": UA, accept: "application/json", "content-type": "application/json" },
            body: method === "POST" ? "{}" : undefined,
          });
          if (!r.ok) continue;
          const j: any = await r.json().catch(() => null);
          const tok = j?.token || j?.access_token || j?.data?.token;
          if (typeof tok === "string" && tok.length > 8) {
            edgeTokenCache = { token: tok, exp: Date.now() + 5 * 60_000 };
            return tok;
          }
        } catch {
          // continue trying
        }
      }
    }
    return "";
  }

  async function proxyEdgeEndpoint(targetUrl: string, res: Response) {
    try {
      const token = await getEdgeToken();
      const hdrs: Record<string, string> = { "user-agent": UA, accept: "application/json" };
      if (token) hdrs.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      const r = await fetch(targetUrl, { headers: hdrs });
      const text = await r.text();
      if (!r.ok) {
        res.status(200).json({ ok: false, upstreamStatus: r.status, items: [], matches: [] });
        return;
      }
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=180");
      res.send(text);
    } catch {
      res.status(200).json({ ok: false, items: [], matches: [] });
    }
  }

  app.get("/api/edge/matches", async (_req: Request, res: Response) => {
    await proxyEdgeEndpoint("https://edge.hamyra.xyz/cricfy/matches", res);
  });

  app.get("/api/edge/entertainment", async (_req: Request, res: Response) => {
    await proxyEdgeEndpoint("https://edge.hamyra.xyz/tapmad/entertainment", res);
  });

  app.get("/api/edge/feed", async (_req: Request, res: Response) => {
    await proxyEdgeEndpoint("https://edge.hamyra.xyz/web-feed", res);
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
