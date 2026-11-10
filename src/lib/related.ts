import type { Highlight, PlayRequest, RelatedItem, SportMatch, SportsData } from "./api";

/** Builds play requests for sports matches / highlights, each carrying a same-category "related" list. */
export function makeSports(data: SportsData, play: (r: PlayRequest) => void, toast: (m: string) => void) {
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
  function playHighlight(h: Highlight) {
    play({ title: h.title, subtitle: h.rail, poster: h.thumbnail, sources: h.sources, related: relHighlight(h) });
  }
  return { playMatch, playHighlight };
}
