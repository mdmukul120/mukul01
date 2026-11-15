import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
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
import { fmtDuration, fmtViews, timeAgo, ytInnerTubePlayer, ytList, type YtVideo } from "../lib/api";
import { useApp } from "../lib/store";
import { loadYt, YT_ERRORS } from "./Details";
import { cn } from "../utils/cn";
import "../pages/yt.css";

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

function RowCard({ v, onOpen }: { v: YtVideo; onOpen: (v: YtVideo) => void }) {
  return (
    <button className="yt-row" onClick={() => onOpen(v)} aria-label={v.title}>
      <div className="yt-thumb">
        {v.thumb ? <img src={v.thumb} alt="" loading="lazy" /> : null}
        <div className="yt-hoverplay">
          <span>
            <Play size={22} fill="currentColor" />
          </span>
        </div>
        {v.live ? <span className="yt-live">LIVE</span> : v.duration ? <span className="yt-dur">{fmtDuration(v.duration)}</span> : null}
      </div>
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

function YtWatchInstance({ video }: { video: YtVideo }) {
  const {
    toast: appToast,
    play,
    ytMini,
    setYtMini,
    setYtWatch,
    setYtPlaying,
    registerYtToggle,
    bgPlay,
    setTab,
  } = useApp();

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
  const [rel, setRel] = useState<YtVideo[]>([]);

  // Drag offset for floating mini-player
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

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
    setYtPlaying(playing);
    if (playing) wake();
    else {
      window.clearTimeout(hideTimer.current);
      setCtl(true);
    }
  }, [playing, wake, setYtPlaying]);

  const toggle = useCallback(() => {
    const p = player.current;
    if (!p?.getPlayerState) return;
    if (p.getPlayerState() === 1) p.pauseVideo();
    else p.playVideo();
    wake();
  }, [wake]);

  useEffect(() => {
    registerYtToggle(toggle);
    return () => registerYtToggle(null);
  }, [toggle, registerYtToggle]);

  // System MediaSession for YouTube background & lockscreen controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: video.title || "YouTube ভিডিও",
        artist: video.channel || "Mukul Tube",
        artwork: video.thumb ? [{ src: video.thumb, sizes: "480x360", type: "image/jpeg" }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => player.current?.playVideo?.());
      navigator.mediaSession.setActionHandler("pause", () => player.current?.pauseVideo?.());
      navigator.mediaSession.setActionHandler("seekbackward", (d) => {
        const curT = player.current?.getCurrentTime?.() || 0;
        player.current?.seekTo?.(Math.max(0, curT - (d.seekOffset || 10)), true);
      });
      navigator.mediaSession.setActionHandler("seekforward", (d) => {
        const curT = player.current?.getCurrentTime?.() || 0;
        player.current?.seekTo?.(curT + (d.seekOffset || 10), true);
      });
    } catch {
      /* unsupported */
    }
  }, [video]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch {
      /* ignore */
    }
  }, [playing]);

  // Keep playing seamlessly in background when bgPlay is active
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && !bgPlay) {
        player.current?.pauseVideo?.();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [bgPlay]);

  // Up next related videos
  useEffect(() => {
    let dead = false;
    const q = video.title && video.title !== PLACEHOLDER_TITLE ? video.title.slice(0, 70) : "trending bangladesh";
    ytList(q)
      .then((r) => {
        if (!dead && r.items.length) setRel(r.items);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      dead = true;
    };
  }, [video.id, video.title]);

  // Create YouTube iframe player
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

  const launchInnerTubeBg = async () => {
    showToast("ব্যাকগ্রাউন্ড/PiP স্ট্রিম লোড হচ্ছে…");
    try {
      const data = await ytInnerTubePlayer(video.id);
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
        setYtWatch(null);
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
  };

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

  // Drag handlers for floating mode
  const onFloatDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ytMini) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: dragOffset.x,
      origY: dragOffset.y,
    };
  };
  const onFloatMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const maxW = Math.max(80, window.innerWidth - 230);
    const maxH = Math.max(80, window.innerHeight - 180);
    setDragOffset({
      x: Math.max(-maxW, Math.min(12, d.origX + dx)),
      y: Math.max(-maxH, Math.min(20, d.origY + dy)),
    });
  };
  const onFloatUp = () => {
    dragState.current.active = false;
  };

  const VolIcon = muted || vol === 0 ? VolumeX : vol < 50 ? Volume1 : Volume2;
  const pct = dur ? clamp((cur / dur) * 100, 0, 100) : 0;
  const more = rel.filter((r) => r.id !== video.id).slice(0, 16);
  const stats = statLine(video);

  return (
    <div
      className={cn(
        ytMini
          ? "fixed bottom-24 right-3 z-[75] w-[224px] sm:w-[280px] lg:bottom-6 lg:right-6 touch-none select-none"
          : "yt absolute inset-0 z-[68] overflow-y-auto bg-ink animate-[fadeIn_.2s_ease]"
      )}
      style={ytMini ? { transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` } : undefined}
      onPointerDown={onFloatDown}
      onPointerMove={onFloatMove}
      onPointerUp={onFloatUp}
      onPointerCancel={onFloatUp}
    >
      <section className={ytMini ? "w-full" : "yt-watch"}>
        <div className={ytMini ? "glow-ring relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl" : "yt-vwrap"}>
          <div className={ytMini ? "relative h-full w-full bg-black" : "yt-vbox" + (ctl ? " ctl" : "")} ref={box}>
            {!ytMini && (
              <>
                <div className="yt-bright" style={{ background: `rgba(0,0,0,${1 - bright})` }} />
                <div className="yt-cover" onTouchStart={gStart} onTouchMove={gMove} onTouchEnd={gEnd} onMouseMove={wake} onClick={onCoverClick} />
                <button
                  type="button"
                  className="yt-back"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    setYtWatch(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setYtWatch(null);
                  }}
                  aria-label="বন্ধ করুন"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setYtMini(true);
                  }}
                  aria-label="ফ্লোটিং প্লেয়ার"
                  title="ফ্লোটিং প্লেয়ার"
                  className="absolute right-3 top-2.5 z-25 grid h-9 w-9 place-items-center rounded-full bg-black/75 text-white backdrop-blur transition hover:bg-neon hover:text-ink active:scale-90"
                >
                  <PictureInPicture2 size={17} />
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
              </>
            )}

            {/* Tree-stable iframe holder */}
            <div className={ytMini ? "absolute inset-0" : "yt-ratio"}>
              <div className={ytMini ? "h-full w-full [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0" : "yt-holder"} ref={holder} />
            </div>

            {ytMini ? (
              <div className="absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-b from-black/75 via-transparent to-black/80 p-2">
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setYtMini(false);
                      setTab("youtube");
                    }}
                    aria-label="বড় করুন"
                    title="বড় করুন"
                    className="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-90 hover:bg-neon hover:text-ink"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <span className="truncate px-1 text-[10px] font-bold text-white/90">{video.title}</span>
                  <button
                    type="button"
                    onClick={() => setYtWatch(null)}
                    aria-label="বন্ধ করুন"
                    title="বন্ধ করুন"
                    className="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-90 hover:bg-live"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? "পজ" : "প্লে"}
                    className="grid h-9 w-9 place-items-center rounded-full bg-neon text-ink shadow-md active:scale-90"
                  >
                    {playing ? <Pause className="h-4 w-4 fill-ink" /> : <Play className="h-4 w-4 fill-ink pl-0.5" />}
                  </button>
                  <span className="text-[9.5px] font-semibold tabular-nums text-white/85">
                    {fmt(cur)} / {fmt(dur)}
                  </span>
                </div>
              </div>
            ) : (
              <>
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
                      <button type="button" className="yt-btn pri" onClick={launchInnerTubeBg}>
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
                      <button className="yt-ib" onClick={() => setYtMini(true)} aria-label="ফ্লোটিং প্লেয়ার">
                        <PictureInPicture2 size={17} />
                      </button>
                      <button className="yt-ib" onClick={fullscreen} aria-label="ফুলস্ক্রিন">
                        {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {!ytMini && (
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
                <button className="yt-btn pri" onClick={launchInnerTubeBg}>
                  <Play size={14} fill="currentColor" /> ইনারটিউব ডিরেক্ট প্লে
                </button>
                <button className="yt-btn" onClick={() => setYtMini(true)}>
                  <PictureInPicture2 size={15} /> ফ্লোটিং প্লে
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
                  <RowCard key={r.id} v={r} onOpen={(v) => setYtWatch(v)} />
                ))}
              </aside>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function YtWatchOverlay() {
  const { ytWatch } = useApp();
  if (!ytWatch) return null;
  return <YtWatchInstance key={ytWatch.id} video={ytWatch} />;
}
