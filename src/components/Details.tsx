import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Play, Shuffle, TriangleAlert } from "lucide-react";
import { useApp } from "../lib/store";
import {
  bongoScrape,
  bongoSources,
  ctgDetail,
  ctgList,
  ctgImg,
  ctgTitle,
  ctgVideo,
  decode,
  fmtViews,
  musicPlaylist,
  ottDetail,
  ottList,
  ottPlaySources,
  bestFirst,
  timeAgo,
  type OttItem,
  type OttSource,
  type RelatedItem,
  type Song,
  type YtVideo,
} from "../lib/api";
import { ErrorState, Loading, useAsync } from "./ui";
import { Art } from "./MusicPlayer";
import { Chrome, MenuButton, toggleFullscreen } from "./PlayerChrome";
import Related from "./Related";
import { SongRow } from "./SongRow";
import { cn } from "../utils/cn";

function Shell({ children, onBack, hero }: { children: ReactNode; onBack: () => void; hero?: string }) {
  return (
    <div className="app-bg absolute inset-0 z-[55] overflow-y-auto animate-[slideUp_.25s_ease]">
      <div className="sticky top-0 z-20 h-0">
        <button onClick={onBack} className="card-edge absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-ink/70 backdrop-blur active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>
      {hero !== undefined && (
        <div className="relative h-64 w-full overflow-hidden bg-surface">
          {hero && <img src={hero} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-black/30" />
        </div>
      )}
      {children}
    </div>
  );
}

function Meta({ items }: { items: (string | undefined | null | number)[] }) {
  const list = items.filter(Boolean) as (string | number)[];
  if (!list.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((m, i) => (
        <span key={i} className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-neon card-edge">
          {m}
        </span>
      ))}
    </div>
  );
}

function TitleBlock({ poster, title, children }: { poster?: string; title: string; children?: ReactNode }) {
  return (
    <div className="relative -mt-24 flex gap-4 px-5">
      <div className="glow-ring h-40 w-[107px] shrink-0 overflow-hidden rounded-2xl bg-surface2">
        {poster && <img src={poster} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1 self-end pb-1">
        <h1 className="text-lg font-extrabold leading-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}

const Btn = ({ children, onClick, primary }: { children: ReactNode; onClick?: () => void; primary?: boolean }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold transition active:scale-95",
      primary ? "glow-soft bg-neon text-ink" : "card-edge bg-surface2"
    )}
  >
    {children}
  </button>
);

// ───────────────────────── OTT (Mukul Plus) ─────────────────────────
function OttView({ slug }: { slug: string }) {
  const { closeDetail, play, toast } = useApp();
  const { data: d, error, loading, reload } = useAsync(() => ottDetail(slug), [slug]);
  const list = useAsync(() => ottList(1), []);
  const [showAll, setShowAll] = useState(false);

  const related = (kind: string | undefined, skip: string): RelatedItem[] =>
    (list.data || [])
      .filter((m: OttItem) => m.slug !== skip && (!kind || m.kind === kind))
      .map((m: OttItem) => ({ key: m.slug, title: m.title, sub: m.language, image: m.poster, open: () => go(m.slug) }));

  async function go(sl: string) {
    toast("লোড হচ্ছে…");
    try {
      const x = await ottDetail(sl);
      const src = bestFirst(x.watch_sources)[0] || bestFirst(x.episodes[0]?.sources || [])[0];
      if (!src) return toast("এই কনটেন্টের সোর্স পাওয়া যায়নি");
      play({ title: x.title, subtitle: x.language, poster: x.backdrop || x.poster, sources: ottPlaySources(src), related: related(x.kind, sl) });
    } catch {
      toast("লোড করা যায়নি");
    }
  }

  const playSrc = (s: OttSource, title: string, sub?: string) =>
    play({ title, subtitle: sub, poster: d?.backdrop || d?.poster, sources: ottPlaySources(s), related: related(d?.kind, slug) });

  const label = (s: OttSource) => [s.quality ? `${s.quality}p` : "", s.audio, s.type?.toUpperCase(), s.hevc ? "HEVC" : ""].filter(Boolean).join(" • ");

  return (
    <Shell onBack={closeDetail} hero={d ? d.backdrop || d.poster : ""}>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {d && (
        <div className="pb-24">
          <TitleBlock poster={d.poster} title={d.title}>
            <Meta items={[d.kind?.toUpperCase(), d.language, d.quality, d.resolution, d.imdb_rating ? `★ ${d.imdb_rating}` : null]} />
          </TitleBlock>

          <div className="mt-5 space-y-1.5 px-5 text-[13px] leading-relaxed text-mute">
            {d.released && <p><span className="text-white/90">রিলিজ:</span> {d.released}</p>}
            {d.genre && <p><span className="text-white/90">জনরা:</span> {d.genre}</p>}
            {d.duration && <p><span className="text-white/90">সময়:</span> {d.duration}</p>}
            {d.cast && d.cast.length > 0 && <p><span className="text-white/90">কাস্ট:</span> {d.cast.join(", ")}</p>}
            {d.description && <p className="pt-1">{d.description}</p>}
          </div>

          {d.episodes.length === 0 && d.watch_sources.length > 0 && (
            <div className="mt-6 px-5">
              <h3 className="mb-3 text-base font-bold">দেখুন</h3>
              <div className="space-y-2.5">
                {bestFirst(d.watch_sources).map((s, i) => (
                  <button key={i} onClick={() => playSrc(s, d.title, label(s))} className="panel flex w-full items-center gap-3 rounded-2xl p-3 text-left active:scale-[0.98]">
                    <span className="glow-soft grid h-11 w-11 place-items-center rounded-full bg-neon text-ink">
                      <Play className="h-4 w-4 fill-ink" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold">{label(s) || `সোর্স ${i + 1}`}</span>
                      <span className="block truncate text-[10.5px] text-mute">{s.name || s.provider}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {d.episodes.length > 0 && (
            <div className="mt-6 px-5">
              <h3 className="mb-3 text-base font-bold">এপিসোড ({d.episodes.length})</h3>
              <div className="space-y-2.5">
                {(showAll ? d.episodes : d.episodes.slice(0, 12)).map((ep) => (
                  <div key={ep.episodeNumber} className="panel rounded-2xl p-3.5">
                    <p className="text-[13px] font-bold">{decode(ep.title)}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {bestFirst(ep.sources).map((s, i) => (
                        <button key={i} onClick={() => playSrc(s, d.title, decode(ep.title))} className="flex items-center gap-1.5 rounded-full bg-neon px-3.5 py-1.5 text-[11px] font-bold text-ink active:scale-95">
                          <Play className="h-3 w-3 fill-ink" /> {s.quality ? `${s.quality}p` : "প্লে"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {!showAll && d.episodes.length > 12 && (
                <button onClick={() => setShowAll(true)} className="card-edge mt-3 w-full rounded-full bg-surface2 py-3 text-sm font-semibold">
                  সব এপিসোড দেখুন
                </button>
              )}
            </div>
          )}

          {d.screenshots.length > 0 && (
            <div className="mt-7">
              <h3 className="mb-3 px-5 text-base font-bold">স্ক্রিনশট</h3>
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5">
                {d.screenshots.map((s, i) => (
                  <img key={i} src={s} alt="" loading="lazy" referrerPolicy="no-referrer" className="card-edge h-28 shrink-0 rounded-xl object-cover" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

// ───────────────────────── CTGHall ─────────────────────────
function CtgView({ id }: { id: number }) {
  const { closeDetail, play, toast } = useApp();
  const { data: m, error, loading, reload } = useAsync(() => ctgDetail(id), [id]);
  const list = useAsync(() => ctgList(1, 1), []);
  const title = m ? ctgTitle(m.title) : "";
  const video = ctgVideo(m?.url);

  const related = (skip: number): RelatedItem[] =>
    (list.data?.data || [])
      .filter((x) => x.id !== skip)
      .map((x) => ({ key: String(x.id), title: ctgTitle(x.title), sub: x.year ? String(x.year) : undefined, image: ctgImg(x.poster_path), open: () => go(x.id) }));

  async function go(i: number) {
    toast("লোড হচ্ছে…");
    try {
      const x = await ctgDetail(i);
      play({
        title: ctgTitle(x.title),
        subtitle: x.Library?.name,
        poster: ctgImg(x.backdrop_path, "w780") || ctgImg(x.poster_path, "w500"),
        sources: [{ label: "সার্ভার ১", url: ctgVideo(x.url) }],
        related: related(i),
      });
    } catch {
      toast("লোড করা যায়নি");
    }
  }
  const doPlay = () =>
    play({
      title,
      subtitle: m?.Library?.name,
      poster: ctgImg(m?.backdrop_path, "w780") || ctgImg(m?.poster_path, "w500"),
      sources: [{ label: "সার্ভার ১", url: video }],
      related: related(id),
    });
  return (
    <Shell onBack={closeDetail} hero={m ? ctgImg(m.backdrop_path, "w780") || ctgImg(m.poster_path, "w780") : ""}>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {m && (
        <div className="pb-24">
          <TitleBlock poster={ctgImg(m.poster_path, "w342")} title={title}>
            <Meta items={[m.year ? String(m.year) : null, m.Library?.name, m.online_rating ? `★ ${m.online_rating}` : null]} />
          </TitleBlock>
          <div className="mt-5 px-5">
            <Btn primary onClick={doPlay}>
              <Play className="h-4 w-4 fill-ink" /> এখনই দেখুন
            </Btn>
          </div>
          <div className="mt-5 space-y-2 px-5 text-[13px] leading-relaxed text-mute">
            {m.tagline && <p className="italic">{m.tagline}</p>}
            {m.genre && <p><span className="text-white/90">জনরা:</span> {m.genre}</p>}
            {m.casts && <p><span className="text-white/90">কাস্ট:</span> {m.casts}</p>}
            {m.overview && !m.overview.includes("+(") && <p>{decode(m.overview)}</p>}
          </div>
        </div>
      )}
    </Shell>
  );
}

// ───────────────────────── Bongo ─────────────────────────
function BongoView({ item }: { item: import("../lib/api").BongoItem }) {
  const { closeDetail, play } = useApp();
  const all = useAsync(bongoScrape, []);
  const group = all.data?.find((c) => c.items.some((i) => i.id === item.id));
  const reqFor = (it: import("../lib/api").BongoItem): import("../lib/api").PlayRequest => ({
    title: it.title,
    subtitle: it.category || "",
    poster: it.landscape || it.thumbnail,
    sources: bongoSources(it.id),
    related: (group?.items || [])
      .filter((x) => x.id !== it.id)
      .map((x) => ({ key: x.id, title: x.title, sub: x.category, image: x.landscape || x.thumbnail, open: () => play(reqFor(x)) })),
  });
  return (
    <Shell onBack={closeDetail} hero={item.landscape || item.thumbnail}>
      <div className="pb-24">
        <TitleBlock poster={item.thumbnail} title={item.title}>
          <Meta items={[item.category, item.contentType?.replace("VOD_", ""), item.premium ? "Premium" : "Free"]} />
        </TitleBlock>
        <div className="mt-5 px-5">
          <Btn
            primary
            onClick={() => play(reqFor(item))}
          >
            <Play className="h-4 w-4 fill-ink" /> প্লে করুন
          </Btn>
        </div>
      </div>
    </Shell>
  );
}

// ───────────────────────── Playlist ─────────────────────────
function PlaylistView({ id, name, image }: { id: string; name?: string; image?: string }) {
  const { closeDetail, playQueue } = useApp();
  const { data: p, error, loading, reload } = useAsync(() => musicPlaylist(id), [id]);
  const songs: Song[] = p?.songs || [];
  return (
    <Shell onBack={closeDetail}>
      <div className="relative overflow-hidden px-5 pb-4 pt-16">
        {(p?.image || image) && <img src={p?.image || image} referrerPolicy="no-referrer" alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink" />
        <div className="relative flex flex-col items-center text-center">
          <Art src={p?.image || image} className="glow-ring h-44 w-44 rounded-3xl" />
          <h1 className="mt-5 text-xl font-extrabold">{p?.name || name}</h1>
          {p?.description && <p className="mt-1 line-clamp-2 text-xs text-mute">{p.description}</p>}
          {songs.length > 0 && <p className="mt-1 text-xs text-mute">{songs.length} টি গান</p>}
          {songs.length > 0 && (
            <div className="mt-4 flex gap-3">
              <Btn primary onClick={() => playQueue(songs, 0)}>
                <Play className="h-4 w-4 fill-ink" /> সব চালান
              </Btn>
              <Btn onClick={() => playQueue([...songs].sort(() => Math.random() - 0.5), 0)}>
                <Shuffle className="h-4 w-4" /> শাফল
              </Btn>
            </div>
          )}
        </div>
      </div>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="px-3 pb-32">
        {songs.map((s, i) => (
          <SongRow key={s.id + i} song={s} list={songs} i={i} />
        ))}
      </div>
    </Shell>
  );
}

// ───────────────────────── YouTube (custom controls over the IFrame API) ─────────────────────────
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let ytApi: Promise<any> | null = null;
export const loadYt = (): Promise<any> => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApi) return ytApi;
  ytApi = new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    const fail = (m: string) => {
      ytApi = null; // allow a retry next time
      rej(new Error(m));
    };
    const timer = window.setTimeout(() => fail("YouTube API লোড হয়নি"), 12000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      prev?.();
      res(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      window.clearTimeout(timer);
      fail("YouTube স্ক্রিপ্ট ব্লক হয়েছে (ইন্টারনেট/অ্যাডব্লকার চেক করুন)");
    };
    document.head.appendChild(s);
  });
  return ytApi;
};

export const YT_ERRORS: Record<number, string> = {
  2: "ভিডিও আইডি ঠিক নেই",
  5: "প্লেয়ারে সমস্যা হয়েছে, আবার চেষ্টা করুন",
  100: "ভিডিওটি মুছে ফেলা হয়েছে বা প্রাইভেট",
  101: "ভিডিওর মালিক অন্য সাইটে চালানোর অনুমতি দেননি",
  150: "ভিডিওর মালিক অন্য সাইটে চালানোর অনুমতি দেননি",
  153: "রেফারার/অরিজিন পাওয়া যায়নি (ফাইল থেকে খুললে বা no-referrer থাকলে এটি হয়)",
};

function YtView({ video, related }: { video: YtVideo; related?: YtVideo[] }) {
  const { closeDetail, toast } = useApp();
  const [cur, setCur] = useState(video);
  const holder = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const curRef = useRef(video);
  const relRef = useRef<YtVideo[]>(related || []);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [menuOpen, setMenuOpen] = useState(false);
  const [err, setErr] = useState("");

  curRef.current = cur;
  relRef.current = related || [];

  const items = useMemo<RelatedItem[]>(
    () =>
      (related || [])
        .filter((v) => v.id !== cur.id)
        .map((v) => ({ key: v.id, title: v.title, sub: v.channel, image: v.thumb, live: v.live, open: () => setCur(v) })),
    [related, cur.id]
  );

  useEffect(() => {
    let dead = false;
    const box = holder.current;
    loadYt()
      .then((YT) => {
        if (dead || !box) return;
        // Build the iframe ourselves so we can force a Referer for just this iframe
        // (YouTube rejects embeds that arrive with no referrer → "Error 153").
        const ifr = document.createElement("iframe");
        ifr.referrerPolicy = "strict-origin-when-cross-origin";
        ifr.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        ifr.title = "YouTube";
        ifr.style.border = "0";
        const qs = new URLSearchParams({
          enablejsapi: "1",
          autoplay: "1",
          controls: "0",
          rel: "0",
          playsinline: "1",
          modestbranding: "1",
          fs: "0",
          iv_load_policy: "3",
          disablekb: "1",
        });
        if (/^https?:/.test(location.origin)) {
          qs.set("origin", location.origin);
        }
        ifr.src = `https://www.youtube.com/embed/${curRef.current.id}?${qs}`;
        box.appendChild(ifr);
        player.current = new YT.Player(ifr, {
          events: {
            onReady: (e: any) => e.target.playVideo(),
            onStateChange: (e: any) => {
              const st = e.data;
              setPlaying(st === 1 || st === 3);
              setLoading(st === 3 || st === -1);
              if (st === 1) setErr("");
              if (st === 0) {
                const pool = relRef.current.filter((v) => v.id !== curRef.current.id);
                if (pool.length) setCur(pool[Math.floor(Math.random() * pool.length)]);
              }
            },
            onError: (e: any) => {
              setLoading(false);
              setErr(YT_ERRORS[e?.data] || "এই ভিডিও এখানে চালানো যাচ্ছে না");
            },
          },
        });
      })
      .catch((e) => {
        if (dead) return;
        setLoading(false);
        setErr(e?.message || "ইউটিউব প্লেয়ার লোড হয়নি");
      });
    const poll = window.setInterval(() => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      setT(p.getCurrentTime() || 0);
      setDur(p.getDuration() || 0);
      setMuted(!!p.isMuted?.());
    }, 400);
    const f = () => setIsFull(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    document.addEventListener("fullscreenchange", f);
    document.addEventListener("webkitfullscreenchange", f);
    return () => {
      dead = true;
      window.clearInterval(poll);
      document.removeEventListener("fullscreenchange", f);
      document.removeEventListener("webkitfullscreenchange", f);
      player.current?.destroy?.();
      player.current = null;
      if (box) box.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    player.current?.loadVideoById?.(cur.id);
    setErr("");
    setT(0);
    setDur(0);
    setLoading(true);
  }, [cur.id]);

  return (
    <div className="app-bg absolute inset-0 z-[55] overflow-y-auto animate-[slideUp_.25s_ease]">
      <div ref={wrap} className="sticky top-0 z-20 mx-auto aspect-video w-full bg-black lg:max-w-[880px]">
        <div ref={holder} className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full" />
        <Chrome
          title={cur.title}
          subtitle={cur.channel}
          live={cur.live}
          playing={playing}
          loading={loading}
          cur={t}
          dur={dur}
          muted={muted}
          isFull={isFull}
          menuOpen={menuOpen}
          onBack={closeDetail}
          onToggle={() => (playing ? player.current?.pauseVideo?.() : player.current?.playVideo?.())}
          onSeek={(x) => {
            player.current?.seekTo?.(x, true);
            setT(x);
          }}
          onMute={() => (muted ? player.current?.unMute?.() : player.current?.mute?.())}
          onFullscreen={() => toggleFullscreen(wrap.current, () => toast("ফুলস্ক্রিন সাপোর্ট করছে না"))}
          extras={
            <MenuButton
              label={speed + "x"}
              value={speed}
              onOpen={setMenuOpen}
              options={["0.5", "0.75", "1", "1.25", "1.5", "2"].map((x) => ({ id: x, label: x + "x" }))}
              onPick={(id) => {
                setSpeed(id);
                player.current?.setPlaybackRate?.(Number(id));
              }}
            />
          }
        />
        {err && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2.5 bg-black/90 p-4 text-center">
            <TriangleAlert className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold">ভিডিও চালানো যাচ্ছে না</p>
            <p className="max-w-[300px] text-[11px] leading-relaxed text-mute">{err}</p>
            <a
              href={`https://www.youtube.com/watch?v=${cur.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-soft flex items-center gap-2 rounded-full bg-neon px-5 py-2 text-xs font-bold text-ink active:scale-95"
            >
              <ExternalLink className="h-3.5 w-3.5" /> YouTube-এ দেখুন
            </a>
          </div>
        )}
      </div>
      <div className="px-4 pt-4">
        <h2 className="text-[17px] font-extrabold leading-snug">{cur.title}</h2>
        <p className="mt-1.5 text-sm text-mute">{[cur.channel, cur.views ? fmtViews(cur.views) + " ভিউ" : "", timeAgo(cur.published)].filter(Boolean).join(" • ")}</p>
      </div>
      <Related items={items} title="একই ক্যাটাগরির আরও হাইলাইটস" />
    </div>
  );
}

export default function Details() {
  const { detail } = useApp();
  if (!detail) return null;
  switch (detail.t) {
    case "ott":
      return <OttView key={detail.slug} slug={detail.slug} />;
    case "ctg":
      return <CtgView key={detail.id} id={detail.id} />;
    case "bongo":
      return <BongoView key={detail.item.id} item={detail.item} />;
    case "playlist":
      return <PlaylistView key={detail.id} id={detail.id} name={detail.name} image={detail.image} />;
    case "yt":
      return <YtView key={detail.video.id + (detail.related?.length || 0)} video={detail.video} related={detail.related} />;
  }
}
