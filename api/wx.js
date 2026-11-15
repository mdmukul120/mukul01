// Server-side Weather gateway for Vercel Edge.
import { UA, json, sameOriginOnly } from "./_util.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (!sameOriginOnly(req)) return json({ error: "forbidden" }, 403);
  const q = (new URL(req.url).searchParams.get("q") || "Dhaka").trim();
  const key = (typeof process !== "undefined" && process.env && process.env.WEATHER_API_KEY) || "241e16270ce941668ad100110231508";
  try {
    const r = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${encodeURIComponent(q)}&days=3&aqi=yes&alerts=no`,
      { headers: { "user-agent": UA, accept: "application/json" } }
    );
    const data = await r.json().catch(() => ({}));
    return json(data, r.status, r.ok ? "public, s-maxage=300, stale-while-revalidate=600" : "no-store");
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 502);
  }
}
