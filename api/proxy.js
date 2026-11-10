// Server-side fetch for third-party JSON / text APIs (fixes browser CORS errors).
import { UA, json, parseTarget, sameOriginOnly } from "./_util.js";

export const config = { runtime: "edge" };

const ALLOWED = [
  /^mukul-ott\.ai\.studio$/,
  /(^|\.)ctghall\.com$/,
  /\.workers\.dev$/,
  /^mukulsport1?\.vercel\.app$/,
  /^music45-api\.vercel\.app$/,
];

export default async function handler(req) {
  if (!sameOriginOnly(req)) return json({ error: "forbidden" }, 403);
  const target = parseTarget(new URL(req.url).searchParams.get("url"));
  if (!target || !ALLOWED.some((r) => r.test(target.hostname))) return json({ error: "host not allowed" }, 400);

  try {
    const upstream = await fetch(target.toString(), {
      headers: { "user-agent": UA, accept: "application/json, text/plain, */*" },
      redirect: "follow",
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        "cache-control": upstream.ok ? "public, s-maxage=30, stale-while-revalidate=120" : "no-store",
      },
    });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 502);
  }
}
