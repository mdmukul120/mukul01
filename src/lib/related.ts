import {
  ytInnerTubePlayer,
  type Highlight,
  type PlayRequest,
  type PlaySource,
  type RelatedItem,
  type SportMatch,
  type SportsData,
  type YtVideo,
} from "./api";
import type { Detail } from "./store";

/** Builds play requests for sports matches / highlights, each carrying a same-category "related" list. */
export function makeSports(
  data: SportsData,
  play: (r: PlayRequest) => void,
  toast: (m: string) => void,
  openDetail?: (d: Detail) => void
) {
  const mItem = (m: SportMatch): RelatedItem => ({
    key: "m" + m.id + m.status,
    title: m.title,
    sub: m.league,
    image: m.image,
    live: m.status === "live",
    open: () => playMatch(m),
  });
  const hItem = (h: Highlight): RelatedItem => ({
    key: "h" + h.id + h.sources[0].url,
    title: h.title,
    sub: h.rail,
    image: h.thumbnail,
    open: () => playHighlight(h),
  });
  const uniq = (a: RelatedItem[]) => {
    const seen = new Set<string>();
    return a.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
  };

  const relMatch = (m: SportMatch): RelatedItem[] => {
    const sport = (m.sport || "").toLowerCase();
    const others = data.matches.filter((x) => x !== m && x.servers.length);
    const sameM = others.filter((x) => !sport || (x.sport || "").toLowerCase() === sport);
    const sameH = data.highlights.filter((h) => sport && `${h.rail} ${h.title}`.toLowerCase().includes(sport));
    return uniq([...sameM.map(mItem), ...sameH.map(hItem), ...others.map(mItem), ...data.highlights.map(hItem)]);
  };
  const relHighlight = (h: Highlight): RelatedItem[] => {
    const same = data.highlights.filter((x) => x !== h && x.rail === h.rail);
    const rest = data.highlights.filter((x) => x !== h && x.rail !== h.rail);
    return uniq([...same.map(hItem), ...rest.map(hItem)]);
  };

  function playMatch(m: SportMatch) {
    if (!m.servers.length) return toast("এই ম্যাচের স্ট্রিম এখনো শুরু হয়নি");
    play({ title: m.title, subtitle: m.league, poster: m.image, sources: m.servers, live: m.status === "live", related: relMatch(m) });
  }

  async function playHighlight(h: Highlight) {
    if (h.ytId) {
      toast("হাইলাইটস লোড হচ্ছে…");
      try {
        const d = await ytInnerTubePlayer(h.ytId);
        const sources: PlaySource[] = [];
        if (d.hlsManifestUrl) {
          sources.push({ label: "HLS স্ট্রিম", url: d.hlsManifestUrl, hls: true });
        }
        (d.formats || [])
          .filter((f) => f.url)
          .sort((a, b) => (b.height || 0) - (a.height || 0))
          .forEach((f, idx) => {
            sources.push({
              label: f.qualityLabel || `সার্ভার ${idx + 1}`,
              url: f.url!,
              noLocalProxy: true,
            });
          });
        if (sources.length) {
          play({
            title: h.title,
            subtitle: d.author || h.rail,
            poster: h.thumbnail || d.thumbnail,
            sources,
            related: relHighlight(h),
          });
          return;
        }
      } catch {
        // fallback to YouTube detail player
      }
      if (h.ytVideo && openDetail) {
        const relYt: YtVideo[] = data.highlights
          .filter((x) => x !== h && x.ytVideo)
          .map((x) => x.ytVideo!);
        openDetail({ t: "yt", video: h.ytVideo, related: relYt });
        return;
      }
      toast("হাইলাইটস চালু করা যায়নি");
      return;
    }
    play({ title: h.title, subtitle: h.rail, poster: h.thumbnail, sources: h.sources, related: relHighlight(h) });
  }

  return { playMatch, playHighlight };
}
