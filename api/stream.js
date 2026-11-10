// Same-origin media proxy: fixes CORS / mixed-content (http) / hotlink problems for
// MP4 files and HLS (.m3u8) streams. HLS playlists are rewritten so every segment
// also goes through this function. Range requests are passed through for seeking.
import { UA, json, parseTarget, sameOriginOnly } from "./_util.js";

export const config = { runtime: "edge" };

const proxied = (abs) => `/api/stream?url=${encodeURIComponent(abs)}`;

function rewritePlaylist(text, base) {
  const abs = (u) => new URL(u, base).toString();
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

export default async function handler(req) {
  if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method" }, 405);
  if (!sameOriginOnly(req)) return json({ error: "forbidden" }, 403);
  const target = parseTarget(new URL(req.url).searchParams.get("url"));
  if (!target) return json({ error: "bad url" }, 400);

  const headers = { "user-agent": UA, accept: "*/*" };
  const range = req.headers.get("range");
  if (range) headers.range = range;

  let upstream;
  try {
    upstream = await fetch(target.toString(), { method: req.method, headers, redirect: "follow" });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 502);
  }

  const ct = upstream.headers.get("content-type") || "";
  const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(target.pathname + target.search);

  if (isPlaylist && upstream.ok) {
    const text = await upstream.text();
    if (text.trimStart().startsWith("#EXTM3U")) {
      return new Response(rewritePlaylist(text, upstream.url || target.toString()), {
        status: 200,
        headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store" },
      });
    }
    return new Response(text, { status: upstream.status, headers: { "content-type": ct || "text/plain" } });
  }

  const out = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // .mkv files are often served as x-matroska / octet-stream; many browsers refuse those by MIME alone.
  // Relabel them (Chrome/Edge/Android sniff the real container and play H.264 + AAC just fine).
  const ctype = out.get("content-type") || "";
  if (/\.mkv(\?|$)/i.test(target.pathname + target.search) || /matroska|octet-stream/i.test(ctype)) {
    if (!/\.(mp4|m4v|webm|mov)(\?|$)/i.test(target.pathname)) out.set("content-type", "video/mp4");
  }
  if (!out.has("accept-ranges")) out.set("accept-ranges", "bytes");
  out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
