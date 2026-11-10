import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Radio } from "lucide-react";
import { bongoScrape, ctgImg, ctgList, ctgTitle, fmtStart, loadSports, musicPlaylists, ottList, type SportMatch } from "../lib/api";
import { useApp } from "../lib/store";
import { makeSports } from "../lib/related";
import { Footer, MatchTile, PosterCard, Rail, useAsync } from "../components/ui";
import { Art } from "../components/MusicPlayer";
import { cn } from "../utils/cn";

interface HeroItem {
  key: string;
  title: string;
  img?: string;
  badge: string;
  pill: string;
  desc: string;
  live?: boolean;
  cta: string;
  open: () => void;
}

function Hero({ items }: { items: HeroItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const iRef = useRef(0);
  const touched = useRef(false);
  const n = items.length;

  const stride = () => {
    const k = ref.current?.children[0] as HTMLElement | undefined;
    return k ? k.offsetWidth + 14 : 1;
  };
  const goTo = (idx: number) => ref.current?.scrollTo({ left: idx * stride(), behavior: "smooth" });
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / stride())));
    iRef.current = idx;
    setI(idx);
  };

  useEffect(() => {
    if (n < 2) return;
    const t = window.setInterval(() => {
      if (!touched.current) goTo((iRef.current + 1) % n);
    }, 4800);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const cur = items[i];
  if (!cur) return null;

  return (
    <>
      <div
        ref={ref}
        onScroll={onScroll}
        onTouchStart={() => (touched.current = true)}
        className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-[18%] pb-8 pt-6"
      >
        {items.map((h, k) => (
          <button
            key={h.key}
            onClick={() => (k === i ? h.open() : goTo(k))}
            className={cn(
              "relative h-[330px] w-[64%] shrink-0 snap-center overflow-hidden rounded-[28px] bg-surface text-left transition-all duration-500",
              k === i ? "glow-ring scale-100" : "card-edge scale-[0.86] opacity-50"
            )}
          >
            <div className="relative h-[58%] w-full overflow-hidden bg-surface2">
              {h.img && <img src={h.img} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover object-top" />}
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/20" />
              <span className="absolute right-3 top-3 rounded-full bg-ink/75 px-3 py-1 text-[11px] font-extrabold text-neon backdrop-blur">{h.badge}</span>
              {h.live && (
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-extrabold backdrop-blur">
                  <span className="live-dot h-2.5 w-2.5 rounded-full bg-live" /> LIVE
                </span>
              )}
            </div>
            <div className="flex h-[42%] flex-col justify-between p-4">
              <h3 className="line-clamp-2 text-[17px] font-bold leading-tight">{h.title}</h3>
              <span className="w-fit rounded-full bg-neon/10 px-3 py-1 text-[12px] font-bold text-neon">{h.pill}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="panel mx-5 flex items-center gap-4 rounded-[26px] p-4">
        <span className="glow-soft grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-neon text-ink">
          <Play className="h-6 w-6 fill-ink" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold">{cur.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-mute">{cur.desc}</p>
        </div>
        <button onClick={cur.open} className="glow-soft flex shrink-0 items-center gap-2 rounded-full bg-neon px-4 py-3 text-[13px] font-extrabold text-ink active:scale-95">
          <Play className="h-3.5 w-3.5 fill-ink" /> {cur.cta}
        </button>
      </div>
    </>
  );
}

export default function Home() {
  const { setTab, openDetail, play, toast } = useApp();
  const ott = useAsync(() => ottList(1), []);
  const ctg = useAsync(() => ctgList(1, 1), []);
  const bongo = useAsync(bongoScrape, []);
  const pls = useAsync(() => musicPlaylists("Hindi top hits", 12), []);
  const sports = useAsync(loadSports, []);

  const live = sports.data?.matches.filter((m) => m.status === "live") || [];
  const upcoming = sports.data?.matches.filter((m) => m.status !== "live") || [];
  const highlights = sports.data?.highlights || [];

  const S = sports.data ? makeSports(sports.data, play, toast) : null;
  const playMatch = (m: SportMatch) => S?.playMatch(m);

  const heroItems = useMemo<HeroItem[]>(() => {
    const a: HeroItem[] = [...live, ...upcoming]
      .filter((m) => m.image)
      .slice(0, 4)
      .map((m) => ({
        key: "m" + m.id,
        title: m.title,
        img: m.image,
        badge: (m.sport || "SPORTS").toUpperCase(),
        pill: m.status === "live" ? "এখন লাইভ" : fmtStart(m.start) || "শীঘ্রই",
        desc: [m.league, m.servers.length ? `${m.servers.length} টি সার্ভার` : "স্ট্রিম শীঘ্রই"].filter(Boolean).join(" • "),
        live: m.status === "live",
        cta: "স্ট্রিমিং দেখুন",
        open: () => playMatch(m),
      }));
    const b: HeroItem[] = (ott.data || []).slice(0, 5).map((m) => ({
      key: "o" + m.slug,
      title: m.title,
      img: m.poster,
      badge: m.kind === "movie" ? "MOVIE" : "SERIES",
      pill: [m.year, m.quality_tag].filter(Boolean).join(" • ") || "নতুন",
      desc: [m.language, m.quality_tag].filter(Boolean).join(" • ") || "Mukul Plus-এ এখনই দেখুন",
      cta: "দেখুন",
      open: () => openDetail({ t: "ott", slug: m.slug }),
    }));
    return [...a, ...b];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sports.data, ott.data]);

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-5 pb-1 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="glow-soft grid h-10 w-10 place-items-center rounded-xl bg-neon text-ink">
            <Play className="h-5 w-5 fill-ink" />
          </span>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            Mukul <span className="text-neon">Plus</span>
          </h1>
        </div>
        <button onClick={() => setTab("sports")} className="card-edge flex items-center gap-2 rounded-full bg-surface2 px-3.5 py-2 text-[11px] font-extrabold">
          <Radio className="h-3.5 w-3.5 text-live" /> LIVE{live.length ? ` • ${live.length}` : ""}
        </button>
      </div>

      {heroItems.length > 0 ? (
        <Hero items={heroItems} />
      ) : (
        <div className="mx-5 mt-6 h-[330px] animate-pulse rounded-[28px] bg-surface2" />
      )}

      {live.length > 0 && (
        <Rail title="লাইভ ম্যাচসমূহ" count={live.length} dot="live">
          {live.map((m) => (
            <MatchTile key={m.id} m={m} onPlay={playMatch} />
          ))}
        </Rail>
      )}

      {upcoming.length > 0 && (
        <Rail title="আসন্ন ম্যাচসমূহ" count={upcoming.length} dot="soon">
          {upcoming.map((m) => (
            <MatchTile key={m.id} m={m} onPlay={playMatch} />
          ))}
        </Rail>
      )}

      {highlights.length > 0 && (
        <Rail title="হাইলাইটস" count={highlights.length}>
          {highlights.map((h) => (
            <button
              key={h.id + h.sources[0].url}
              onClick={() => S?.playHighlight(h)}
              className="card-edge relative aspect-video w-[72%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-[22px] bg-surface2 text-left active:scale-[0.96]"
            >
              {h.thumbnail && <img src={h.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
              <p className="absolute inset-x-3 bottom-2.5 line-clamp-2 text-[12px] font-bold leading-tight">{h.title}</p>
            </button>
          ))}
        </Rail>
      )}

      <Rail title="নতুন মুভি ও সিরিজ">
        {(ott.data || Array.from({ length: 5 })).map((m, i) =>
          m ? (
            <PosterCard
              key={(m as any).slug}
              className="w-[118px] shrink-0 snap-start"
              image={(m as any).poster}
              title={(m as any).title}
              badge={(m as any).kind === "movie" ? (m as any).quality_tag : (m as any).kind}
              sub={(m as any).language}
              onClick={() => openDetail({ t: "ott", slug: (m as any).slug })}
            />
          ) : (
            <div key={i} className="aspect-[2/3] w-[118px] shrink-0 animate-pulse rounded-[20px] bg-surface2" />
          )
        )}
      </Rail>

      {bongo.data && (
        <Rail title="নাটক ও ওয়েব সিরিজ">
          {bongo.data
            .find((c) => c.key === "drama")
            ?.items.slice(0, 14)
            .map((m) => (
              <PosterCard key={m.id} className="w-[118px] shrink-0 snap-start" image={m.thumbnail} title={m.title} premium={m.premium} onClick={() => openDetail({ t: "bongo", item: m })} />
            ))}
        </Rail>
      )}

      {ctg.data && (
        <Rail title="নতুন সংযোজন">
          {ctg.data.data.map((m) => (
            <PosterCard
              key={m.id}
              className="w-[118px] shrink-0 snap-start"
              image={ctgImg(m.poster_path)}
              title={ctgTitle(m.title)}
              rating={m.online_rating}
              sub={m.year ? String(m.year) : undefined}
              onClick={() => openDetail({ t: "ctg", id: m.id })}
            />
          ))}
        </Rail>
      )}

      {pls.data && pls.data.length > 0 && (
        <Rail title="গানের প্লেলিস্ট">
          {pls.data.map((p) => (
            <button key={p.id} onClick={() => openDetail({ t: "playlist", id: p.id, name: p.name, image: p.image })} className="w-[136px] shrink-0 snap-start text-left active:scale-95">
              <Art src={p.image} className="card-edge aspect-square w-full rounded-[22px]" />
              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-tight">{p.name}</p>
            </button>
          ))}
        </Rail>
      )}

      <Footer />
    </div>
  );
}
