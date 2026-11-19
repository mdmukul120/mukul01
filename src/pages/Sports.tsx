import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Flame,
  Megaphone,
  Play,
  RefreshCw,
  Search,
  Star,
  Trophy,
  Tv,
  X,
} from "lucide-react";
import { clearApiCache, fmtStart, loadSports, type Highlight, type SportMatch } from "../lib/api";
import { makeSports } from "../lib/related";
import { useApp } from "../lib/store";
import { ErrorState, Loading, useAsync } from "../components/ui";
import { cn } from "../utils/cn";

/* ───────────────────────── helpers ───────────────────────── */
function splitTeams(m: SportMatch): {
  aName: string;
  bName: string;
  aLogo?: string;
  bLogo?: string;
  isVs: boolean;
} {
  if (m.teamA?.name && m.teamB?.name) {
    return {
      aName: m.teamA.name,
      bName: m.teamB.name,
      aLogo: m.teamA.logo,
      bLogo: m.teamB.logo,
      isVs: true,
    };
  }
  const parts = m.title.split(/\s+vs\.?\s+|\s+v\s+/i);
  if (parts.length >= 2) {
    return {
      aName: parts[0].trim(),
      bName: parts.slice(1).join(" vs ").trim(),
      aLogo: m.teamA?.logo || m.image,
      bLogo: m.teamB?.logo || m.leagueLogo,
      isVs: true,
    };
  }
  return {
    aName: m.title,
    bName: m.league || m.sport || "",
    aLogo: m.image || m.leagueLogo,
    bLogo: m.leagueLogo,
    isVs: false,
  };
}

function parseStartMs(start?: string): number | null {
  if (!start) return null;
  const iso = start.endsWith("Z") || /\+\d\d:?\d\d$/.test(start) ? start : start + "Z";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function fmtHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function matchClockLabel(m: SportMatch, nowMs: number): string {
  const ms = parseStartMs(m.start);
  if (m.status === "live") {
    if (ms && nowMs >= ms && nowMs - ms < 6 * 3600 * 1000) {
      return fmtHMS((nowMs - ms) / 1000);
    }
    return m.statusDetail || m.dhakaTime || "LIVE";
  }
  if (ms) {
    const diff = (ms - nowMs) / 1000;
    if (diff > 0 && diff < 48 * 3600) return fmtHMS(diff);
    if (diff <= 0 && Math.abs(diff) < 3 * 3600) return fmtHMS(Math.abs(diff));
  }
  return m.dhakaTime || fmtStart(m.start) || m.statusDetail || "শীঘ্রই";
}

function isSameDay(ms: number, ref: Date): boolean {
  const d = new Date(ms);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function isMatchFinished(m: SportMatch, nowMs: number): boolean {
  const st = (m.status || "").toLowerCase();
  const det = (m.statusDetail || "").toLowerCase();
  if (st === "finished" || st === "completed" || /finish|ended|\bft\b/.test(det)) return true;
  const ms = parseStartMs(m.start);
  return !!(st !== "live" && ms && nowMs - ms > 4 * 3600 * 1000);
}

/* Custom crisp sport tile icons matching screenshot aesthetic */
function SportTileIcon({ sport, className }: { sport: string; className?: string }) {
  const k = sport.toLowerCase();
  if (k === "all") {
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className}>
        <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="1.8" strokeDasharray="5 3" />
        <circle cx="18" cy="18" r="9.5" stroke="currentColor" strokeWidth="1.5" />
        <text x="18" y="21.5" textAnchor="middle" fill="currentColor" fontSize="9.5" fontWeight="800" fontFamily="sans-serif">
          ALL
        </text>
      </svg>
    );
  }
  if (k.includes("foot") || k.includes("soccer")) {
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className}>
        <circle cx="18" cy="18" r="12.5" stroke="currentColor" strokeWidth="1.8" />
        <polygon points="18,12 23,15.6 21.1,21.5 14.9,21.5 13,15.6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M18 12V6M23 15.6l6-2M21.1 21.5l3.8 5.2M14.9 21.5l-3.8 5.2M13 15.6l-6-2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (k.includes("crick")) {
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className}>
        <path d="M13 8v19M18 8v19M23 8v19M11.5 8h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M24 25l5-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="9.5" cy="24.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (k.includes("box") || k.includes("ufc") || k.includes("mma") || k.includes("wwe") || k.includes("wrest") || k.includes("fight")) {
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className}>
        <path d="M9 17c0-4 2.5-6.5 6-6.5 2.4 0 4 1.3 4 3.5v7c0 2.2-1.6 3.5-4 3.5-3.5 0-6-2.2-6-5.5V17z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M27 17c0-4-2.5-6.5-6-6.5-1.2 0-2 .4-2 .4v10.2s.8.4 2 .4c3.5 0 6-2.2 6-5.5V17z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M11 24.5h6M19 24.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (k.includes("f1") || k.includes("motor") || k.includes("rac") || k.includes("moto")) {
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className}>
        <path d="M6 21h24l-3-5h-8l-3-4H9l-3 5v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="11" cy="23" r="3.2" stroke="currentColor" strokeWidth="1.7" fill="var(--surface)" />
        <circle cx="25" cy="23" r="3.2" stroke="currentColor" strokeWidth="1.7" fill="var(--surface)" />
      </svg>
    );
  }
  if (k.includes("tenn")) {
    return (
      <svg viewBox="0 0 36 36" fill="none" className={className}>
        <ellipse cx="20" cy="14" rx="7" ry="8.5" transform="rotate(35 20 14)" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14.5 20.5L8 28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (k === "highlights") {
    return <Flame className={className} />;
  }
  return <Trophy className={className} />;
}

/* ───────────────────────── cards ───────────────────────── */
function TeamAvatar({ logo, name }: { logo?: string; name: string }) {
  const [err, setErr] = useState(false);
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface2 p-1.5 ring-1 ring-line">
      {logo && !err ? (
        <img src={logo} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[11px] font-extrabold text-neon">{(name || "SP").slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function MatchCard({
  m,
  nowMs,
  fav,
  onToggleFav,
  onSelect,
}: {
  m: SportMatch;
  nowMs: number;
  fav: boolean;
  onToggleFav: () => void;
  onSelect: () => void;
}) {
  const { aName, bName, aLogo, bLogo, isVs } = splitTeams(m);
  const live = m.status === "live";
  const finished = isMatchFinished(m, nowMs);
  const clock = matchClockLabel(m, nowMs);
  const headerLine = [m.sport, m.league].filter(Boolean).join("  ||  ") || "SPORTS MATCH";

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="w-full cursor-pointer rounded-2xl border border-neon/45 bg-surface px-3.5 pt-3 pb-0 text-left shadow-md transition hover:border-neon active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon"
      >
        {/* Top league strip + Favorite star */}
        <div className="relative flex items-center justify-center px-8">
          <div className="flex items-center justify-center gap-1.5 min-w-0">
            {m.leagueLogo ? (
              <img src={m.leagueLogo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-4 w-4 shrink-0 rounded-sm object-contain" />
            ) : (
              <Trophy className="h-3.5 w-3.5 shrink-0 text-neon" />
            )}
            <p className="truncate text-[11px] font-bold tracking-wide uppercase">
              {headerLine}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            aria-label={fav ? "প্রিয় থেকে সরান" : "প্রিয়তে যোগ করুন"}
            className="absolute -right-1 -top-1.5 grid h-9 w-9 place-items-center rounded-full text-mute transition hover:text-neon active:scale-90"
          >
            <Star className={cn("h-4 w-4", fav ? "fill-neon text-neon" : "text-mute")} />
          </button>
        </div>

        {/* Center matchup grid */}
        {isVs ? (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamAvatar logo={aLogo} name={aName} />
              <span className="line-clamp-2 text-[12.5px] sm:text-[13px] font-semibold leading-snug">{aName}</span>
            </div>

            <div className="flex flex-col items-center justify-center px-1.5 text-center">
              {live ? (
                <>
                  <span className="live-dot mb-1 h-2 w-2 rounded-full bg-live" />
                  <span className="text-[11px] font-extrabold text-live">Live</span>
                </>
              ) : finished ? (
                <span className="text-[11px] font-bold text-mute">Finished</span>
              ) : (
                <span className="text-[11px] font-bold text-neon">VS</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 min-w-0 text-right">
              <span className="line-clamp-2 text-[12.5px] sm:text-[13px] font-semibold leading-snug">{bName}</span>
              <TeamAvatar logo={bLogo} name={bName} />
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3 pb-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <TeamAvatar logo={aLogo} name={aName} />
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13.5px] font-bold leading-snug">{aName}</p>
                {bName && <p className="mt-0.5 truncate text-[11px] text-mute">{bName}</p>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              {live ? (
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-live">
                  <span className="live-dot h-2 w-2 rounded-full bg-live" /> Live
                </span>
              ) : (
                <span className="text-[11px] font-bold text-neon">{m.servers.length ? `${m.servers.length} লিংক` : "শীঘ্রই"}</span>
              )}
            </div>
          </div>
        )}

        {/* Bottom centered countdown / match clock notch */}
        <div className="mt-1 flex justify-center">
          <span className="rounded-t-xl border-x border-t border-line bg-ink px-4 py-0.5 text-[11px] font-extrabold tracking-wider tabular-nums">
            {clock}
          </span>
        </div>
      </div>
    </div>
  );
}

function HlCard({ h, onPlay }: { h: Highlight; onPlay: (h: Highlight) => void }) {
  return (
    <button onClick={() => onPlay(h)} className="w-full text-left transition active:scale-[0.97]">
      <div className="card-edge relative aspect-video overflow-hidden rounded-2xl bg-surface2">
        {h.thumbnail && <img src={h.thumbnail} alt={h.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <span className="glow-soft absolute bottom-2.5 left-2.5 grid h-9 w-9 place-items-center rounded-full bg-neon text-ink">
          <Play className="h-4 w-4 fill-ink" />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 px-0.5 text-[12.5px] font-semibold leading-tight">{h.title}</p>
    </button>
  );
}

/* ───────────────────────── Stream Picker Modal ───────────────────────── */
function StreamChooserModal({
  match,
  onClose,
  onPick,
}: {
  match: SportMatch;
  onClose: () => void;
  onPick: (sourceIndex: number) => void;
}) {
  const emblem = match.leagueLogo || match.image || match.teamA?.logo;
  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-[fadeIn_.18s_ease]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Multiple Links Available"
    >
      <div
        className="w-full max-w-md rounded-3xl border-[1.5px] border-neon bg-surface p-5 shadow-2xl animate-[slideUp_.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow">
          {emblem ? (
            <img src={emblem} alt={match.title} referrerPolicy="no-referrer" className="h-full w-full object-contain" />
          ) : (
            <Tv className="h-7 w-7 text-emerald-600" />
          )}
        </div>

        <h3 className="mt-3 text-center text-[17px] font-extrabold tracking-tight">Multiple Links Available</h3>
        <p className="mt-0.5 text-center text-xs text-mute">আপনার পছন্দের স্ট্রিমিং লিংক নির্বাচন করুন</p>
        <div className="mx-auto mt-2.5 h-[3px] w-14 rounded-full bg-neon" />

        <p className="mt-3 truncate text-center text-xs font-semibold text-neon">{match.title}</p>

        <div className="mt-3.5 max-h-[42vh] space-y-2.5 overflow-y-auto pr-0.5">
          {match.servers.map((srv, idx) => (
            <button
              key={srv.url + idx}
              type="button"
              onClick={() => onPick(idx)}
              className="flex min-h-[50px] w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface2/80 px-3.5 py-2.5 text-left transition hover:border-neon active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1 ring-1 ring-line">
                  {emblem ? (
                    <img src={emblem} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-emerald-600 text-emerald-600" />
                  )}
                </span>
                <span className="truncate text-[13px] font-bold">{srv.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-mute" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3.5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface2/60 text-sm font-bold transition hover:border-neon active:scale-95"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Main Sports Page ───────────────────────── */
export default function Sports() {
  const { play, toast, openDetail } = useApp();
  const { data, error, loading, reload } = useAsync(loadSports, []);
  const [filter, setFilter] = useState<"all" | "live" | "today" | "finished" | "tomorrow" | "upcoming" | "hl">("all");
  const [sportType, setSportType] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [favIds, setFavIds] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem("fav_sports");
      return s ? (JSON.parse(s) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [pickerMatch, setPickerMatch] = useState<SportMatch | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const toggleFav = (id: string) => {
    setFavIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("fav_sports", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleRefresh = () => {
    clearApiCache();
    reload();
    toast("স্পোর্টস ফিড আপডেট হচ্ছে…");
  };

  const allMatches = data?.matches || [];
  const allHighlights = data?.highlights || [];

  const sportCategories = useMemo(() => {
    const map = new Map<string, number>();
    allMatches.forEach((m) => {
      const s = (m.sport || "Sports").trim();
      map.set(s, (map.get(s) || 0) + 1);
    });
    const list = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return list;
  }, [allMatches]);

  // Apply sport category tile, favorite filter & search query before computing counts
  const baseMatches = useMemo(() => {
    let list = allMatches;
    if (sportType !== "all" && sportType !== "highlights") {
      list = list.filter((m) => (m.sport || "Sports").toLowerCase() === sportType.toLowerCase());
    }
    if (onlyFav) {
      list = list.filter((m) => favIds.includes(m.id));
    }
    const q = searchQ.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.league || "").toLowerCase().includes(q) ||
          (m.sport || "").toLowerCase().includes(q) ||
          (m.teamA?.name || "").toLowerCase().includes(q) ||
          (m.teamB?.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allMatches, sportType, onlyFav, favIds, searchQ]);

  const counts = useMemo(() => {
    const todayDate = new Date(nowMs);
    const tomorrowDate = new Date(nowMs + 86400_000);
    let live = 0;
    let today = 0;
    let finished = 0;
    let tomorrow = 0;
    let upcoming = 0;
    baseMatches.forEach((m) => {
      const fin = isMatchFinished(m, nowMs);
      const isL = m.status === "live";
      const ms = parseStartMs(m.start);
      if (isL) live++;
      if (fin) finished++;
      if (isL || (ms && isSameDay(ms, todayDate))) today++;
      if (ms && isSameDay(ms, tomorrowDate)) tomorrow++;
      if (!isL && !fin) upcoming++;
    });
    return {
      all: baseMatches.length,
      live,
      today,
      finished,
      tomorrow,
      upcoming,
      hl: allHighlights.length,
    };
  }, [baseMatches, allHighlights.length, nowMs]);

  const visibleMatches = useMemo(() => {
    if (filter === "hl" || sportType === "highlights") return [];
    const todayDate = new Date(nowMs);
    const tomorrowDate = new Date(nowMs + 86400_000);
    const filtered = baseMatches.filter((m) => {
      const fin = isMatchFinished(m, nowMs);
      const isL = m.status === "live";
      const ms = parseStartMs(m.start);
      switch (filter) {
        case "live":
          return isL;
        case "today":
          return isL || !!(ms && isSameDay(ms, todayDate));
        case "finished":
          return fin;
        case "tomorrow":
          return !!(ms && isSameDay(ms, tomorrowDate));
        case "upcoming":
          return !isL && !fin;
        default:
          return true;
      }
    });
    // Sort live matches first cleanly
    return [...filtered].sort((a, b) => {
      const al = a.status === "live" ? 0 : 1;
      const bl = b.status === "live" ? 0 : 1;
      return al - bl;
    });
  }, [baseMatches, filter, sportType, nowMs]);

  const filteredHighlights = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return allHighlights;
    return allHighlights.filter((h) => h.title.toLowerCase().includes(q) || h.rail.toLowerCase().includes(q));
  }, [allHighlights, searchQ]);

  const S = data ? makeSports(data, play, toast, openDetail) : null;
  const playHl = (h: Highlight) => S?.playHighlight(h);

  const openMatchChooser = (m: SportMatch) => {
    if (!m.servers.length) {
      toast("এই ম্যাচের স্ট্রিম এখনো শুরু হয়নি");
      return;
    }
    if (m.servers.length === 1) {
      S?.playMatch(m, 0);
      return;
    }
    setPickerMatch(m);
  };

  const timeFilters: { id: typeof filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "live", label: "Live", count: counts.live },
    { id: "today", label: "Today", count: counts.today },
    { id: "finished", label: "Finished", count: counts.finished },
    { id: "tomorrow", label: "Tomorrow", count: counts.tomorrow },
    { id: "upcoming", label: "Upcoming", count: counts.upcoming },
    { id: "hl", label: "হাইলাইটস", count: counts.hl },
  ];

  const showHighlightsSection = filter === "hl" || sportType === "highlights" || (filter === "all" && sportType === "all" && filteredHighlights.length > 0);

  return (
    <div className="pb-10">
      {/* Top Action Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-ink/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[20px] font-extrabold tracking-tight">
            লাইভ <span className="text-neon">স্পোর্টস</span>
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOnlyFav((v) => !v)}
              aria-label="প্রিয় ম্যাচসমূহ"
              title="প্রিয় ম্যাচসমূহ"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl transition active:scale-90",
                onlyFav ? "bg-neon text-ink" : "text-mute hover:bg-surface2 hover:text-neon"
              )}
            >
              <Star className={cn("h-5 w-5", onlyFav && "fill-ink")} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="রিফ্রেশ করুন"
              title="রিফ্রেশ করুন"
              className="grid h-10 w-10 place-items-center rounded-xl text-mute transition hover:bg-surface2 hover:text-neon active:scale-90 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-5 w-5", loading && "animate-spin text-neon")} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((s) => !s);
                if (searchOpen) setSearchQ("");
              }}
              aria-label="সার্চ করুন"
              title="সার্চ করুন"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl transition active:scale-90",
                searchOpen ? "bg-neon text-ink" : "text-mute hover:bg-surface2 hover:text-neon"
              )}
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-neon">
            <Search className="h-4 w-4 shrink-0 text-neon" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="দল, লিগ বা খেলা খুঁজুন…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mute"
              autoFocus
            />
            {searchQ && (
              <button type="button" onClick={() => setSearchQ("")} className="p-1 text-mute hover:text-neon">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Notice / Ticker Bar */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-neon/45 bg-surface px-3 py-2">
          <Megaphone className="h-4 w-4 shrink-0 text-neon" />
          <p className="truncate text-[11.5px] font-medium text-mute">
            ক্রিকেট, ফুটবল, WWE, UFC, F1 এবং সকল লাইভ ম্যাচের HD স্ট্রিমিং লিংক নিয়মিত আপডেট করা হয়।
          </p>
        </div>
      </div>

      {/* Sport Icon Tiles with Top-Right Counter Badges */}
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => {
            setSportType("all");
            if (filter === "hl") setFilter("all");
          }}
          className={cn(
            "relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-2xl border transition active:scale-95",
            sportType === "all" && filter !== "hl"
              ? "border-neon bg-surface2 text-neon glow-soft"
              : "border-line bg-surface text-mute hover:border-neon/60"
          )}
          aria-label="সব খেলা"
        >
          <SportTileIcon sport="all" className="h-9 w-9" />
          <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-live px-1.5 py-0.5 text-center text-[10px] font-extrabold text-white tabular-nums shadow">
            {allMatches.length}
          </span>
        </button>

        {sportCategories.map(([name, count]) => {
          const active = sportType.toLowerCase() === name.toLowerCase() && filter !== "hl";
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSportType(name);
                if (filter === "hl") setFilter("all");
              }}
              aria-label={name}
              title={name}
              className={cn(
                "relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-2xl border transition active:scale-95",
                active ? "border-neon bg-surface2 text-neon glow-soft" : "border-line bg-surface text-mute hover:border-neon/60"
              )}
            >
              <SportTileIcon sport={name} className="h-9 w-9" />
              <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-live px-1.5 py-0.5 text-center text-[10px] font-extrabold text-white tabular-nums shadow">
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setFilter("hl")}
          aria-label="হাইলাইটস"
          title="হাইলাইটস"
          className={cn(
            "relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-2xl border transition active:scale-95",
            filter === "hl" ? "border-neon bg-surface2 text-neon glow-soft" : "border-line bg-surface text-mute hover:border-neon/60"
          )}
        >
          <SportTileIcon sport="highlights" className="h-8 w-8" />
          <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-neon px-1.5 py-0.5 text-center text-[10px] font-extrabold text-ink tabular-nums shadow">
            {allHighlights.length}
          </span>
        </button>
      </div>

      {/* Status / Schedule Filter Tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2.5 pb-1">
        {timeFilters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-[38px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 py-1.5 text-[12px] font-bold tabular-nums transition active:scale-95",
                active
                  ? "border-neon bg-neon text-ink glow-soft"
                  : "border-neon/30 bg-surface text-mute hover:border-neon hover:text-neon"
              )}
            >
              {f.label} ({f.count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && !data && <Loading label="লাইভ ম্যাচ ও হাইলাইটস লোড হচ্ছে…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="mt-3 space-y-4 px-4">
          {filter !== "hl" && sportType !== "highlights" && (
            <>
              {visibleMatches.length > 0 ? (
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                  {visibleMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      m={m}
                      nowMs={nowMs}
                      fav={favIds.includes(m.id)}
                      onToggleFav={() => toggleFav(m.id)}
                      onSelect={() => openMatchChooser(m)}
                    />
                  ))}
                </div>
              ) : (
                <div className="panel rounded-2xl p-6 text-center text-sm text-mute">
                  {onlyFav ? "আপনি এখনো কোনো ম্যাচ প্রিয় তালিকায় যোগ করেননি" : "এই ফিল্টারে এখন কোনো ম্যাচ নেই"}
                </div>
              )}
            </>
          )}

          {showHighlightsSection && (
            <section className="pt-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[16px] font-bold tracking-tight">
                  ম্যাচ হাইলাইটস <span className="text-xs font-semibold text-mute tabular-nums">({filteredHighlights.length})</span>
                </h2>
              </div>
              {filteredHighlights.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredHighlights.map((h) => (
                    <HlCard key={h.id + h.sources[0].url} h={h} onPlay={playHl} />
                  ))}
                </div>
              ) : (
                <p className="panel rounded-2xl p-5 text-center text-sm text-mute">কোনো হাইলাইটস পাওয়া যায়নি</p>
              )}
            </section>
          )}
        </div>
      )}

      {pickerMatch && (
        <StreamChooserModal
          match={pickerMatch}
          onClose={() => setPickerMatch(null)}
          onPick={(idx) => {
            const m = pickerMatch;
            setPickerMatch(null);
            S?.playMatch(m, idx);
          }}
        />
      )}
    </div>
  );
}
