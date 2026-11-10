import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sun,
  TriangleAlert,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { fmtDuration, fmtViews, timeAgo, ytIdFromUrl, ytInnerTubePlayer, ytList, type YtVideo } from "../lib/api";
import { useApp } from "../lib/store";
import { loadYt, YT_ERRORS } from "../components/Details";
import "./yt.css";

/* [id, label, search query]  — "" query = trending (all kinds of videos) */
const CATS: [string, string, string][] = [
  ["all", "সব", ""],
  ["live", "লাইভ", "live stream লাইভ"],
  ["music", "গান", "বাংলা গান new bangla song"],
  ["sports", "খেলাধুলা", "sports highlights recent match"],
  ["cricket", "ক্রিকেট", "cricket highlights recent match"],
  ["football", "ফুটবল", "football highlights recent match goal"],
  ["movie", "মুভি", "বাংলা মুভি movie trailer full movie"],
  ["natok", "নাটক", "বাংলা নাটক natok"],
  ["news", "খবর", "বাংলা খবর news today"],
  ["comedy", "কমেডি", "funny comedy bangla"],
  ["gaming", "গেমিং", "gaming gameplay"],
  ["tech", "টেক", "tech review bangla smartphone"],
  ["food", "রান্না", "রান্নার রেসিপি recipe"],
  ["islamic", "ইসলামিক", "ইসলামিক ওয়াজ waz"],
  ["edu", "শিক্ষা", "শিক্ষা education bangla"],
  ["travel", "ভ্রমণ", "travel vlog bangladesh"],
];

const QUALITIES: [string, string][] = [
  ["default", "Auto (স্বয়ংক্রিয়)"],
  ["hd1080", "1080p HD"],
  ["hd720", "720p HD"],
  ["large", "480p SD"],
  ["medium", "360p"],
];
const SPEEDS: [string, string][] = [
  ["0.5", "0.5x"],
  ["1", "স্বাভাবিক"],
  ["1.5", "1.5x"],
  ["2", "2x"],
];

const PLACEHOLDER_TITLE = "YouTube ভিডিও";
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
};
const initial = (s: string) => (s.trim()[0] || "M").toUpperCase();
const statLine = (v: YtVideo) =>
  [v.views ? `${fmtViews(v.views)} ভিউ` : "", v.published ? timeAgo(v.published) : ""].filter(Boolean).join(" · ");

/* ───────────────────────── cards ───────────────────────── */
function Thumb({ v }: { v: YtVideo }) {
  return (
    <div className="yt-thumb">
      {v.thumb ? <img src={v.thumb} alt="" loading="lazy" /> : null}
      <div className="yt-hoverplay">
        <span>
          <Play size={22} fill="currentColor" />
        </span>
      </div>
      {v.live ? <span className="yt-live">LIVE</span> : v.duration ? <span className="yt-dur">{fmtDuration(v.duration)}</span> : null}
    </div>
  );
}

function Card({
  v,
  onOpen,
  onDirectPlay,
}: {
  v: YtVideo;
  onOpen: (v: YtVideo) => void;
  onDirectPlay?: (v: YtVideo) => void;
}) {
  return (
    <div className="yt-card group text-left">
      <div className="relative">
        <button
          type="button"
          className="w-full block text-left"
          onClick={() => onOpen(v)}
          aria-label={v.title}
        >
          <Thumb v={v} />
        </button>
        {onDirectPlay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDirectPlay(v);
            }}
            title="ইনারটিউব ডিরেক্ট প্লেয়ার"
            className="card-edge absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-black/80 px-2.5 py-1 text-[10.5px] font-bold text-neon shadow-lg backdrop-blur hover:bg-neon hover:text-ink active:scale-90 transition"
          >
            <Play size={11} fill="currentColor" /> ডিরেক্ট
          </button>
        )}
      </div>
      <button
        type="button"
        className="yt-meta w-full block text-left cursor-pointer"
        onClick={() => onOpen(v)}
      >
        <div className="flex gap-2.5">
          <div className="yt-ava shrink-0">{initial(v.channel)}</div>
          <div className="yt-txt min-w-0">
            <div className="yt-title clamp2">{v.title}</div>
            <div className="yt-sub">
              {v.channel}
              {statLine(v) ? <br /> : null}
              {statLine(v)}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function RowCard({ v, onOpen }: { v: YtVideo; onOpen: (v: YtVideo) => void }) {
  return (
    <button className="yt-row" onClick={() => onOpen(v)} aria-label={v.title}>
      <Thumb v={v} />
      <div className="yt-txt">
        <div className="yt-title clamp2">{v.title}</div>
        <div className="yt-sub">
          {v.channel}
          {statLine(v) ? <br /> : null}
          {statLine(v)}
        </div>
      </div>
    </button>
  );
}

const Skeletons = ({ n = 6 }: { n?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="yt-card yt-skel" aria-hidden>
        <div className="yt-thumb" />
        <div className="yt-meta">
          <div className="yt-ava" />
          <div className="yt-txt" style={{ flex: 1 }}>
            <div className="l" style={{ width: "92%" }} />
            <div className="l" style={{ width: "55%" }} />
          </div>
        </div>
      </div>
    ))}
  </>
);

/* ───────────────────────── watch page ───────────────────────── */
function Player({ video, related, active, onBack, onOpen }: { video: YtVideo; related: YtVideo[]; active: boolean; onBack: () => void; onOpen: (v: YtVideo) => void }) {
  const { toast: appToast, play } = useApp();
  const holder = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const hideTimer = useRef<number>(0);
  const toastTimer = useRef<number>(0);
  const playingRef = useRef(false);
  const lastTap = useRef(0);
  const gest = useRef({ y: 0, zone: "m", vol: 100, br: 1, on: false });

  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(100);
  const [muted, setMuted] = useState(false);
  const [ctl, setCtl] = useState(true);
  const [menu, setMenu] = useState<"" | "q" | "s">("");
  const [speed, setSpeed] = useState("1");
  const [quality, setQuality] = useState("default");
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const [bright, setBright] = useState(1);
  const [hud, setHud] = useState<{ k: "v" | "b"; val: number } | null>(null);
  const [full, setFull] = useState(false);
  const [openDesc, setOpenDesc] = useState(false);
  const [rel, setRel] = useState<YtVideo[]>(related);

  const showToast = (m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1600);
  };

  const wake = useCallback(() => {
    setCtl(true);
    window.clearTimeout(hideTimer.current);
    if (playingRef.current) {
      hideTimer.current = window.setTimeout(() => {
        setCtl(false);
        setMenu("");
      }, 2800);
    }
  }, []);

  useEffect(() => {
    playingRef.current = playing;
    if (playing) wake();
    else {
      window.clearTimeout(hideTimer.current);
      setCtl(true);
    }
  }, [playing, wake]);

  // "up next": videos related to this one (falls back to what is already on the page)
  useEffect(() => {
    let dead = false;
    if (!video.title || video.title === PLACEHOLDER_TITLE) return;
    ytList(video.title.slice(0, 70))
      .then((r) => {
        if (!dead && r.items.length) setRel(r.items);
      })
      .catch(() => {
        /* keep fallback list */
      });
    return () => {
      dead = true;
    };
  }, [video.id, video.title]);

  // create the YouTube player (own iframe so we can force a Referer for it)
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    loadYt()
      .then((YT) => {
        if (dead || !el) return;
        const ifr = document.createElement("iframe");
        ifr.referrerPolicy = "strict-origin-when-cross-origin";
        ifr.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        ifr.title = video.title || "YouTube";
        const qs = new URLSearchParams({ enablejsapi: "1", autoplay: "1", controls: "0", rel: "0", playsinline: "1", modestbranding: "1", fs: "0", iv_load_policy: "3", disablekb: "1" });
        if (/^https?:/.test(location.origin)) qs.set("origin", location.origin);
        ifr.src = `https://www.youtube.com/embed/${video.id}?${qs}`;
        el.appendChild(ifr);
        player.current = new YT.Player(ifr, {
          events: {
            onReady: (e: any) => {
              setDur(e.target.getDuration?.() || 0);
              e.target.playVideo();
            },
            onStateChange: (e: any) => {
              setPlaying(e.data === 1 || e.data === 3);
              if (e.data === 1) setErr("");
            },
            onError: (e: any) => setErr(YT_ERRORS[e?.data] || "এই ভিডিও এখানে চালানো যাচ্ছে না"),
          },
        });
      })
      .catch((e) => !dead && setErr(e?.message || "ইউটিউব প্লেয়ার লোড হয়নি"));

    const iv = window.setInterval(() => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      setCur(p.getCurrentTime() || 0);
      setDur(p.getDuration?.() || 0);
    }, 500);
    const onFs = () => setFull(!!document.fullscreenElement);
    const closeMenu = () => setMenu("");
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("click", closeMenu);
    return () => {
      dead = true;
      window.clearInterval(iv);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(toastTimer.current);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("click", closeMenu);
      try {
        player.current?.destroy?.();
      } catch {
        /* already gone */
      }
      player.current = null;
      if (el) el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pause when the user leaves the YouTube tab
  useEffect(() => {
    if (!active) player.current?.pauseVideo?.();
  }, [active]);

  const toggle = () => {
    const p = player.current;
    if (!p?.getPlayerState) return;
    if (p.getPlayerState() === 1) p.pauseVideo();
    else p.playVideo();
    wake();
  };
  const seekTo = (t: number) => {
    const d = player.current?.getDuration?.() || dur;
    const v = clamp(t, 0, d || t);
    player.current?.seekTo?.(v, true);
    setCur(v);
  };
  const seekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const d = player.current?.getDuration?.() || dur;
    if (!d) return;
    seekTo(clamp((e.clientX - r.left) / r.width, 0, 1) * d);
    wake();
  };
  const setVolume = (v: number) => {
    const p = player.current;
    if (!p) return;
    p.setVolume?.(v);
    setVol(v);
    if (v > 0 && p.isMuted?.()) p.unMute?.();
    setMuted(v === 0);
  };
  const toggleMute = () => {
    const p = player.current;
    if (!p) return;
    if (p.isMuted?.() || muted) {
      p.unMute?.();
      setMuted(false);
      if (vol === 0) setVolume(100);
    } else {
      p.mute?.();
      setMuted(true);
    }
    wake();
  };
  const fullscreen = async () => {
    const el = box.current as any;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    } catch {
      showToast("ফুলস্ক্রিন সাপোর্ট করছে না");
    }
    wake();
  };

  // tap: show controls · double-tap left/right: ∓10s
  const onCoverClick = (e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const now = Date.now();
    if (now - lastTap.current < 320 && (x < r.width * 0.35 || x > r.width * 0.65)) {
      const back = x < r.width * 0.5;
      seekTo((player.current?.getCurrentTime?.() || cur) + (back ? -10 : 10));
      showToast(back ? "« ১০ সেকেন্ড" : "১০ সেকেন্ড »");
      lastTap.current = 0;
    } else lastTap.current = now;
    wake();
  };

  // swipe gestures: left = brightness, right = volume
  const gStart = (e: React.TouchEvent) => {
    wake();
    const t = e.touches[0];
    const r = box.current!.getBoundingClientRect();
    const x = t.clientX - r.left;
    gest.current = { y: t.clientY, zone: x < r.width * 0.3 ? "l" : x > r.width * 0.7 ? "r" : "m", vol: player.current?.getVolume?.() ?? vol, br: bright, on: true };
  };
  const gMove = (e: React.TouchEvent) => {
    const g = gest.current;
    if (!g.on) return;
    const r = box.current!.getBoundingClientRect();
    const adj = ((g.y - e.touches[0].clientY) / r.height) * 1.5;
    if (g.zone === "r") {
      const v = clamp(g.vol + adj * 100, 0, 100);
      setVolume(Math.round(v));
      setHud({ k: "v", val: Math.round(v) });
    } else if (g.zone === "l") {
      const b = clamp(g.br + adj, 0.1, 1);
      setBright(b);
      setHud({ k: "b", val: Math.round(b * 100) });
    }
  };
  const gEnd = () => {
    gest.current.on = false;
    window.setTimeout(() => setHud(null), 600);
  };

  const share = async () => {
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else {
        await navigator.clipboard.writeText(url);
        appToast("লিংক কপি হয়েছে");
      }
    } catch {
      /* cancelled */
    }
  };

  const VolIcon = muted || vol === 0 ? VolumeX : vol < 50 ? Volume1 : Volume2;
  const pct = dur ? clamp((cur / dur) * 100, 0, 100) : 0;
  const more = rel.filter((r) => r.id !== video.id).slice(0, 16);
  const stats = statLine(video);

  return (
    <section className="yt-watch">
      <div className="yt-vwrap">
        <div className={"yt-vbox" + (ctl ? " ctl" : "")} ref={box}>
          <div className="yt-bright" style={{ background: `rgba(0,0,0,${1 - bright})` }} />
          <div className="yt-cover" onTouchStart={gStart} onTouchMove={gMove} onTouchEnd={gEnd} onMouseMove={wake} onClick={onCoverClick} />
          <button
            type="button"
            className="yt-back"
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            aria-label="ফিরে যান"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={"yt-toast" + (toast ? " show" : "")}>{toast}</div>
          {hud && (
            <div className={"yt-hud " + hud.k}>
              {hud.k === "v" ? <Volume2 size={18} /> : <Sun size={18} />}
              <span>{hud.val}%</span>
              <i>
                <b style={{ height: hud.val + "%" }} />
              </i>
            </div>
          )}
          <div className="yt-ratio">
            <div className="yt-holder" ref={holder} />
          </div>

          <div className="yt-center">
            <button onClick={toggle} aria-label="প্লে/পজ">
              {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
          </div>

          {err && (
            <div className="yt-err">
              <TriangleAlert size={30} color="#fbbf24" />
              <b>ভিডিও চালানো যাচ্ছে না</b>
              <p>{err}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  className="yt-btn pri"
                  onClick={async () => {
                    showToast("ইনারটিউব স্ট্রিম লোড হচ্ছে…");
                    try {
                      const data = await ytInnerTubePlayer(video.id);
                      const formats = data.formats || [];
                      const sources = formats.filter((f) => f.url).map((f, i) => ({
                        label: f.qualityLabel || f.quality || `ফরম্যাট ${i + 1}`,
                        url: f.url!,
                        hls: false,
                      }));
                      if (data.hlsManifestUrl) {
                        sources.unshift({ label: "HLS লাইভ স্ট্রিম", url: data.hlsManifestUrl, hls: true });
                      }
                      if (sources.length > 0) {
                        onBack();
                        play({
                          title: data.title || video.title,
                          subtitle: data.author || video.channel,
                          poster: data.thumbnail || video.thumb,
                          sources,
                        });
                        return;
                      }
                      showToast("সরাসরি স্ট্রিম পাওয়া যায়নি");
                    } catch {
                      showToast("ইনারটিউব লোড ব্যর্থ");
                    }
                  }}
                >
                  <Play size={14} fill="currentColor" /> ইনারটিউব প্লেয়ার
                </button>
                <a className="yt-btn" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> YouTube-এ দেখুন
                </a>
              </div>
            </div>
          )}

          <div className="yt-ctl" onMouseMove={wake} onClick={(e) => e.stopPropagation()}>
            <div className="yt-prog" onClick={seekBar} role="slider" aria-label="সিক" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(cur)}>
              <div style={{ width: pct + "%" }} />
            </div>
            <div className="yt-row2">
              <div className="yt-grp">
                <button className="yt-ib" onClick={toggle} aria-label="প্লে/পজ">
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button className="yt-ib" onClick={toggleMute} aria-label="মিউট">
                  <VolIcon size={18} />
                </button>
                <input className="yt-vol" type="range" min={0} max={100} step={5} value={muted ? 0 : vol} onChange={(e) => setVolume(Number(e.target.value))} aria-label="ভলিউম" />
                <span className="yt-time">
                  {fmt(cur)} / {fmt(dur)}
                </span>
              </div>
              <div className="yt-grp">
                <div className="yt-menuwrap">
                  <button
                    className="yt-ib"
                    aria-label="কোয়ালিটি"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(menu === "q" ? "" : "q");
                    }}
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                  {menu === "q" && (
                    <div className="yt-menu" onClick={(e) => e.stopPropagation()}>
                      <h4>ভিডিও কোয়ালিটি</h4>
                      {QUALITIES.map(([id, label]) => (
                        <button
                          key={id}
                          className={"yt-opt" + (quality === id ? " on" : "")}
                          onClick={() => {
                            setQuality(id);
                            player.current?.setPlaybackQuality?.(id);
                            setMenu("");
                            showToast("Quality: " + label);
                            wake();
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="yt-menuwrap">
                  <button
                    className="yt-ib"
                    aria-label="প্লেব্যাক গতি"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(menu === "s" ? "" : "s");
                    }}
                  >
                    <Settings size={18} />
                  </button>
                  {menu === "s" && (
                    <div className="yt-menu" onClick={(e) => e.stopPropagation()}>
                      <h4>প্লেব্যাক গতি</h4>
                      {SPEEDS.map(([id, label]) => (
                        <button
                          key={id}
                          className={"yt-opt" + (speed === id ? " on" : "")}
                          onClick={() => {
                            setSpeed(id);
                            player.current?.setPlaybackRate?.(Number(id));
                            setMenu("");
                            showToast("Speed: " + label);
                            wake();
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="yt-ib" onClick={fullscreen} aria-label="ফুলস্ক্রিন">
                  {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="yt-body">
        <div className="yt-main">
          <h1 className="yt-h1">{video.title}</h1>
          {stats && <div className="yt-stats">{stats}</div>}

          {video.channel && (
            <div className="yt-chan">
              <div className="yt-ava">{initial(video.channel)}</div>
              <b>{video.channel}</b>
            </div>
          )}

          <div className="yt-acts">
            <button
              className="yt-btn pri"
              onClick={async () => {
                showToast("ইনারটিউব স্ট্রিম লোড হচ্ছে…");
                try {
                  const data = await ytInnerTubePlayer(video.id);
                  const formats = data.formats || [];
                  const sources = formats.filter((f) => f.url).map((f, i) => ({
                    label: f.qualityLabel || f.quality || `ফরম্যাট ${i + 1}`,
                    url: f.url!,
                    hls: false,
                  }));
                  if (data.hlsManifestUrl) {
                    sources.unshift({ label: "HLS লাইভ স্ট্রিম", url: data.hlsManifestUrl, hls: true });
                  }
                  if (sources.length > 0) {
                    onBack();
                    play({
                      title: data.title || video.title,
                      subtitle: data.author || video.channel,
                      poster: data.thumbnail || video.thumb,
                      sources,
                    });
                    return;
                  }
                  showToast("সরাসরি স্ট্রিম পাওয়া যায়নি");
                } catch {
                  showToast("ইনারটিউব লোড ব্যর্থ");
                }
              }}
            >
              <Play size={14} fill="currentColor" /> ইনারটিউব ডিরেক্ট প্লে
            </button>
            <button className="yt-btn" onClick={share}>
              <Share2 size={15} /> শেয়ার
            </button>
            <a className="yt-btn" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> YouTube-এ খুলুন
            </a>
          </div>

          {video.desc ? (
            <div className={"yt-desc" + (openDesc ? "" : " closed")} onClick={() => setOpenDesc((o) => !o)}>
              {video.desc}
              {!openDesc && <small>আরও দেখুন</small>}
            </div>
          ) : null}
        </div>

        {more.length > 0 && (
          <aside className="yt-side">
            <h3>পরবর্তী ভিডিও</h3>
            {more.map((r) => (
              <RowCard key={r.id} v={r} onOpen={onOpen} />
            ))}
          </aside>
        )}
      </div>
    </section>
  );
}

const YT_SEARCH_SUGGESTIONS = [
  "বাংলা নাটক",
  "নতুন বাংলা গান",
  "লাইভ খবর",
  "Cricket highlights",
  "বাংলা মুভি",
  "কমেডি ভিডিও",
  "রান্নার রেসিপি",
  "ইসলামিক ওয়াজ",
];

/* ───────────────────────── home / browse page ───────────────────────── */
export default function YouTube() {
  const { tab, play, toast } = useApp();
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState("all");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<YtVideo[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<YtVideo | null>(null);
  const gen = useRef(0);
  const busy = useRef(false);

  const query = useMemo(() => q || CATS.find((c) => c[0] === cat)?.[2] || "", [q, cat]);

  const directPlay = useCallback(
    async (v: YtVideo) => {
      toast("ইনারটিউব থেকে সরাসরি স্ট্রিম লোড হচ্ছে…");
      try {
        const data = await ytInnerTubePlayer(v.id);
        const formats = data.formats || [];
        const sources = formats
          .filter((f) => f.url)
          .map((f, i) => ({
            label: f.qualityLabel || f.quality || `ফরম্যাট ${i + 1}`,
            url: f.url!,
            hls: false,
          }));
        if (data.hlsManifestUrl) {
          sources.unshift({ label: "HLS লাইভ স্ট্রিম", url: data.hlsManifestUrl, hls: true });
        }
        if (sources.length > 0) {
          play({
            title: data.title || v.title,
            subtitle: data.author || v.channel,
            poster: data.thumbnail || v.thumb,
            sources,
          });
          return;
        }
        toast("সরাসরি স্ট্রিম পাওয়া যায়নি");
      } catch {
        toast("ইনারটিউব লোড ব্যর্থ");
      }
    },
    [play, toast]
  );

  const load = useCallback(
    async (token?: string) => {
      if (busy.current) return;
      busy.current = true;
      const g = gen.current;
      setLoading(true);
      setError("");
      try {
        const r = await ytList(query, token);
        if (g !== gen.current) return;
        setItems((prev) => {
          const seen = new Set(token ? prev.map((x) => x.id) : []);
          return [...(token ? prev : []), ...r.items.filter((x) => !seen.has(x.id))];
        });
        setNext(r.next);
      } catch (e: any) {
        if (g === gen.current) setError(e?.message || "লোড করা যায়নি");
      } finally {
        busy.current = false;
        if (g === gen.current) setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    gen.current += 1;
    busy.current = false;
    setItems([]);
    setNext(null);
    load();
  }, [load]);

  // infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || open || !next || loading || error) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) load(next);
      },
      { rootMargin: "500px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [next, loading, error, open, load]);

  const scrollTop = () => root.current?.closest("main")?.scrollTo({ top: 0 });
  const show = (v: YtVideo) => {
    setOpen(v);
    scrollTop();
  };
  const back = () => {
    setOpen(null);
    scrollTop();
  };

  const submit = () => {
    const t = input.trim();
    if (!t) return setQ("");
    const id = ytIdFromUrl(t);
    if (id && (t.includes("/") || t.includes("="))) return show({ id, title: PLACEHOLDER_TITLE, channel: "", thumb: "" });
    setQ(t);
    scrollTop();
  };
  const clear = () => {
    setInput("");
    setQ("");
  };
  const pickCat = (id: string) => {
    setCat(id);
    setQ("");
    setInput("");
    scrollTop();
  };

  return (
    <div className="yt" ref={root}>
      {open ? (
        <Player key={open.id} video={open} related={items} active={tab === "youtube"} onBack={back} onOpen={show} />
      ) : (
        <>
          <header className="yt-top">
            <div className="yt-bar">
              <div className="yt-logo">
                <i>
                  <Play size={14} fill="currentColor" />
                </i>
                <b>
                  Mukul <span>Tube</span>
                </b>
              </div>
              <form
                className="yt-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="yt-search-in">
                  <input
                    type="text"
                    value={input}
                    placeholder="ভিডিও সার্চ করুন বা লিংক দিন"
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (!e.target.value) setQ("");
                    }}
                    aria-label="সার্চ"
                  />
                  {input && (
                    <button type="button" className="clr" onClick={clear} aria-label="মুছুন">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button type="submit" className="go" aria-label="সার্চ">
                  <Search size={17} />
                </button>
              </form>
            </div>
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3.5 pb-2 pt-0.5 text-xs">
              <span className="shrink-0 text-[10px] font-bold text-neon uppercase tracking-wider">সাজেশন:</span>
              {YT_SEARCH_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setInput(s);
                    setQ(s);
                    scrollTop();
                  }}
                  className="shrink-0 rounded-full border border-line bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-neon hover:border-neon transition active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="yt-chips">
              {CATS.map(([id, label]) => (
                <button key={id} className={"yt-chip" + (!q && cat === id ? " on" : "")} onClick={() => pickCat(id)}>
                  {label}
                </button>
              ))}
            </div>
          </header>

          {q && (
            <div className="yt-head">
              <div>
                “{q}” <span>এর ফলাফল</span>
              </div>
              <button onClick={clear}>মুছুন</button>
            </div>
          )}

          <div className="yt-grid">
            {items.map((v) => (
              <Card key={v.id} v={v} onOpen={show} onDirectPlay={directPlay} />
            ))}
            {loading && <Skeletons n={items.length ? 3 : 6} />}
            {!loading && !error && items.length === 0 && <div className="yt-msg">কোনো ভিডিও পাওয়া যায়নি!</div>}
            {error && (
              <div className="yt-msg">
                <p>{error.replace(/<[^>]+>/g, "").slice(0, 220)}</p>
                <p>
                  <b>YouTube Data API v3 চালু আছে কিনা এবং কোটা শেষ হয়েছে কিনা দেখুন।</b>
                </p>
                <button className="yt-btn pri" onClick={() => load()}>
                  আবার চেষ্টা করুন
                </button>
              </div>
            )}
          </div>

          <div ref={sentinel} className="yt-sentinel" />
          {next && !loading && !error && (
            <div className="yt-more">
              <button className="yt-btn" onClick={() => load(next)}>
                আরও ভিডিও
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
