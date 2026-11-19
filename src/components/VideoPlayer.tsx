import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import shaka from "shaka-player";
import { ArrowLeft, Copy, Download, ExternalLink, Maximize2, Pause, PictureInPicture2, Play, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useApp } from "../lib/store";
import { isHlsUrl, isMkvUrl, streamUrl, type PlaySource } from "../lib/api";
import { cn } from "../utils/cn";
import { Chrome, MenuButton } from "./PlayerChrome";
import Related from "./Related";

interface Attempt {
  si: number;
  url: string;
  hls: boolean;
  dash: boolean;
  clearKey?: string | null;
  native: boolean;
}

/** Per server: primary -> direct/altUrl -> local /api/stream (with headers & MPD rewriting) -> native fallback. */
function buildAttempts(sources: PlaySource[]): Attempt[] {
  const out: Attempt[] = [];
  const pushUnique = (a: Attempt) => {
    if (!a.url) return;
    if (!out.some((x) => x.si === a.si && x.url === a.url && x.native === a.native && x.dash === a.dash)) {
      out.push(a);
    }
  };

  sources.forEach((s, si) => {
    const dash = !!s.dash || /\.mpd(\?|$)/i.test(s.url) || (!!s.altUrl && /\.mpd(\?|$)/i.test(s.altUrl));
    const hls = !dash && (!!s.hls || isHlsUrl(s.url) || (!!s.altUrl && isHlsUrl(s.altUrl)));

    if (dash) {
      if (!s.url.startsWith("http://")) {
        pushUnique({ si, url: s.url, hls: false, dash: true, clearKey: s.clearKey, native: false });
      }
      if (s.altUrl && !s.altUrl.startsWith("http://")) {
        pushUnique({ si, url: s.altUrl, hls: false, dash: true, clearKey: s.clearKey, native: false });
      }
      if (!s.noLocalProxy) {
        const target = s.altUrl || s.url;
        pushUnique({ si, url: streamUrl(target, s.headers), hls: false, dash: true, clearKey: s.clearKey, native: false });
      }
      return;
    }

    if (!s.url.startsWith("http://")) {
      if (hls) {
        pushUnique({ si, url: s.url, hls: true, dash: false, native: false });
        if (s.altUrl && !s.altUrl.startsWith("http://")) {
          pushUnique({ si, url: s.altUrl, hls: true, dash: false, native: false });
        }
      } else {
        pushUnique({ si, url: s.url, hls: false, dash: false, native: true });
        if (s.altUrl && !s.altUrl.startsWith("http://")) {
          pushUnique({ si, url: s.altUrl, hls: false, dash: false, native: true });
        }
      }
    }

    if (!s.noLocalProxy) {
      const target = s.altUrl || s.url;
      pushUnique({ si, url: streamUrl(target, s.headers), hls, dash: false, native: !hls });
    }

    if (hls && !s.url.startsWith("http://")) {
      pushUnique({ si, url: s.url, hls: true, dash: false, native: true });
    }
  });

  return out;
}

export default function VideoPlayer() {
  const { req, closePlayer, videoMini, setVideoMini, setVideoPlaying, registerVideoToggle, bgPlay, toast } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const shakaRef = useRef<shaka.Player | null>(null);
  const shakaCleanupRef = useRef<Promise<void>>(Promise.resolve());
  const emeBlockedRef = useRef(false);
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [level, setLevel] = useState("-1");
  const [speed, setSpeed] = useState("1");
  const [menuOpen, setMenuOpen] = useState(false);
  const [native, setNative] = useState(false);
  const nativeRef = useRef(false);
  nativeRef.current = native;

  // Floating drag offset state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ active: boolean; moved: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const attempts = useMemo(() => (req ? buildAttempts(req.sources) : []), [req]);
  const att = attempts[step];

  useEffect(() => {
    setStep(0);
    setNative(!!req && req.sources.some((x) => isMkvUrl(x.url)));
    setLevels([]);
    setLevel("-1");
    setSpeed("1");
    setCur(0);
    setDur(0);
    setDragOffset({ x: 0, y: 0 });
  }, [req]);

  useEffect(() => {
    setVideoPlaying(playing);
  }, [playing, setVideoPlaying]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, []);

  useEffect(() => {
    if (!req) {
      registerVideoToggle(null);
      return;
    }
    registerVideoToggle(toggle);
    return () => registerVideoToggle(null);
  }, [req, toggle, registerVideoToggle]);

  // System MediaSession for background playback & lock-screen controls
  useEffect(() => {
    if (!req || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: req.title,
        artist: req.subtitle || (req.live ? "Mukul Plus Live" : "Mukul Plus"),
        artwork: req.poster ? [{ src: req.poster, sizes: "512x512", type: "image/jpeg" }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => videoRef.current?.play().catch(() => undefined));
      navigator.mediaSession.setActionHandler("pause", () => videoRef.current?.pause());
      if (!req.live) {
        navigator.mediaSession.setActionHandler("seekbackward", (d) => {
          if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (d.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler("seekforward", (d) => {
          if (videoRef.current) videoRef.current.currentTime = videoRef.current.currentTime + (d.seekOffset || 10);
        });
      }
    } catch {
      /* unsupported browser */
    }
  }, [req]);

  useEffect(() => {
    if (!req || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch {
      /* ignore */
    }
  }, [req, playing]);

  // Keep playing seamlessly in background if bgPlay enabled
  useEffect(() => {
    if (!req) return;
    const onVis = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden && !bgPlay && !v.paused) {
        v.pause();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [req, bgPlay]);

  useEffect(() => {
    const f = () => setIsFull(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    document.addEventListener("fullscreenchange", f);
    document.addEventListener("webkitfullscreenchange", f);
    return () => {
      document.removeEventListener("fullscreenchange", f);
      document.removeEventListener("webkitfullscreenchange", f);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !att) return;
    setStatus("loading");
    setBuffering(true);
    let hls: Hls | null = null;
    let dashPlayer: shaka.Player | null = null;
    let dead = false;

    const nextStepIndex = (skipClearKey: boolean) => {
      let idx = step + 1;
      if (skipClearKey) {
        while (idx < attempts.length && attempts[idx].dash && attempts[idx].clearKey) {
          idx++;
        }
      }
      return idx;
    };

    const fail = (skipClearKey = false) => {
      if (dead) return;
      dead = true;
      const next = nextStepIndex(skipClearKey);
      if (next < attempts.length) {
        if (attempts[next].si !== att.si) toast("পরবর্তী সার্ভারে চেষ্টা করা হচ্ছে…");
        setStep(next);
      } else {
        setStatus("error");
      }
    };

    const safePlay = () => {
      if (dead) return;
      v.play().catch((err: any) => {
        if (dead) return;
        if (err?.name === "NotAllowedError") {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => undefined);
        }
      });
    };

    const ready = () => {
      if (dead) return;
      setStatus("ready");
      setBuffering(false);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCur(v.currentTime);
    const onDur = () => setDur(v.duration);
    const onVol = () => setMuted(v.muted);
    const onWait = () => setBuffering(true);
    const onEnded = () => {
      const list = req?.related;
      if (!req?.live && list && list.length) list[Math.floor(Math.random() * list.length)].open();
    };

    const onError = () => fail(false);

    v.addEventListener("playing", ready);
    v.addEventListener("playing", onPlay);
    v.addEventListener("loadeddata", ready);
    v.addEventListener("canplay", ready);
    v.addEventListener("error", onError);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("volumechange", onVol);
    v.addEventListener("waiting", onWait);
    v.addEventListener("ended", onEnded);

    if (att.dash) {
      hlsRef.current = null;
      if (emeBlockedRef.current && att.clearKey && attempts.some((a, i) => i > step && !a.clearKey)) {
        fail(true);
      } else {
        (async () => {
          await shakaCleanupRef.current;
          if (dead) return;
          shaka.polyfill.installAll();
          if (!shaka.Player.isBrowserSupported()) {
            fail(false);
            return;
          }
          const player = new shaka.Player();
          dashPlayer = player;
          shakaRef.current = player;
          if (att.clearKey && att.clearKey.includes(":")) {
            const [kid, key] = att.clearKey.split(":");
            if (kid && key) {
              player.configure({
                drm: {
                  clearKeys: {
                    [kid.toLowerCase()]: key.toLowerCase(),
                  },
                },
              });
            }
          }
          player.addEventListener("error", (ev: any) => {
            const code = Number(ev?.detail?.code || 0);
            const isDrm = code >= 6000 && code < 7000;
            if (isDrm) emeBlockedRef.current = true;
            fail(isDrm);
          });
          try {
            await player.attach(v);
            if (dead) return;
            await player.load(att.url);
            if (dead) return;
            const tracks = player.getVariantTracks();
            setLevels([...new Set(tracks.map((t) => t.height).filter((h): h is number => !!h))].sort((a, b) => b - a));
            safePlay();
          } catch (err: any) {
            const code = Number(err?.code || 0);
            const isDrm = (code >= 6000 && code < 7000) || /drm|eme|key|encrypted/i.test(String(err?.message || ""));
            if (isDrm) emeBlockedRef.current = true;
            fail(isDrm);
          }
        })();
      }
    } else if (att.hls && !att.native && Hls.isSupported()) {
      shakaRef.current = null;
      (async () => {
        await shakaCleanupRef.current;
        if (dead) return;
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          manifestLoadingTimeOut: 9000,
          manifestLoadingMaxRetry: 1,
          levelLoadingTimeOut: 9000,
          fragLoadingTimeOut: 12000,
        });
        hlsRef.current = hls;
        hls.loadSource(att.url);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
          if (dead) return;
          setLevels([...new Set(d.levels.map((l) => l.height).filter(Boolean))].sort((a, b) => b - a));
          safePlay();
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (dead || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hls) hls.recoverMediaError();
          else fail(false);
        });
      })();
    } else {
      hlsRef.current = null;
      shakaRef.current = null;
      (async () => {
        await shakaCleanupRef.current;
        if (dead) return;
        v.src = att.url;
        safePlay();
      })();
    }

    const timer = window.setTimeout(() => {
      if (dead || nativeRef.current) return;
      if (v.readyState < 2) fail(false);
    }, 12000);

    return () => {
      dead = true;
      window.clearTimeout(timer);
      v.removeEventListener("playing", ready);
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("loadeddata", ready);
      v.removeEventListener("canplay", ready);
      v.removeEventListener("error", onError);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("volumechange", onVol);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("ended", onEnded);
      hls?.destroy();
      hlsRef.current = null;
      if (dashPlayer) {
        shakaCleanupRef.current = dashPlayer.destroy().catch(() => undefined);
        shakaRef.current = null;
      } else {
        v.removeAttribute("src");
        v.load();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, req, tick]);

  if (!req || !att) return null;

  const fullscreen = async () => {
    const el = wrapRef.current as any;
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        await (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.());
        (screen.orientation as any)?.unlock?.();
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
        try {
          await (screen.orientation as any)?.lock?.("landscape");
        } catch {
          /* unsupported */
        }
      }
    } catch {
      toast("ফুলস্ক্রিন সাপোর্ট করছে না");
    }
  };

  const requestSystemPip = async () => {
    const v = videoRef.current as any;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (v?.requestPictureInPicture) {
        await v.requestPictureInPicture();
      } else {
        setVideoMini(true);
      }
    } catch {
      setVideoMini(true);
    }
  };

  const minimizeToFloating = () => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.())?.catch(() => undefined);
    }
    setVideoMini(true);
  };

  const rawUrl = req.sources.find((x) => /^https?:/.test(x.url))?.url || "";
  const isMkv = req.sources.some((x) => isMkvUrl(x.url));
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const openExternal = () => {
    if (!rawUrl) return;
    if (isAndroid) {
      const u = new URL(rawUrl);
      location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};action=android.intent.action.VIEW;type=video/*;end`;
    } else if (isIOS) location.href = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(rawUrl)}`;
    else {
      navigator.clipboard?.writeText(rawUrl).then(
        () => toast("লিংক কপি হয়েছে — VLC → Open Network Stream-এ পেস্ট করুন"),
        () => toast("এক্সটার্নাল লিংক: " + rawUrl.slice(0, 48))
      );
    }
  };
  const nextServer = () => {
    const n = attempts.findIndex((a, i) => i > step && a.si !== att.si);
    if (n >= 0) {
      setStep(n);
      toast("সার্ভার পরিবর্তন হয়েছে");
    } else toast("আর কোনো সার্ভার নেই");
  };

  // Pointer drag handlers for floating mode
  const onFloatDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!videoMini) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragState.current = {
      active: true,
      moved: false,
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
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
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

  const extras = (
    <>
      {levels.length > 1 && (
        <MenuButton
          label={level === "-1" ? "অটো" : level + "p"}
          value={level}
          onOpen={setMenuOpen}
          options={[{ id: "-1", label: "অটো" }, ...levels.map((h) => ({ id: String(h), label: h + "p" }))]}
          onPick={(id) => {
            setLevel(id);
            if (shakaRef.current) {
              const sp = shakaRef.current;
              if (id === "-1") {
                sp.configure({ abr: { enabled: true } });
              } else {
                sp.configure({ abr: { enabled: false } });
                const track = sp.getVariantTracks().find((t) => t.height === Number(id));
                if (track) sp.selectVariantTrack(track, true);
              }
              return;
            }
            const h = hlsRef.current;
            if (!h) return;
            h.currentLevel = id === "-1" ? -1 : h.levels.findIndex((l) => l.height === Number(id));
          }}
        />
      )}
      {!req.live && (
        <MenuButton
          label={speed + "x"}
          value={speed}
          onOpen={setMenuOpen}
          options={["0.5", "0.75", "1", "1.25", "1.5", "2"].map((x) => ({ id: x, label: x + "x" }))}
          onPick={(id) => {
            setSpeed(id);
            if (videoRef.current) videoRef.current.playbackRate = Number(id);
          }}
        />
      )}
    </>
  );

  return (
    <div
      className={cn(
        videoMini
          ? "fixed bottom-24 right-3 z-[75] w-[224px] sm:w-[280px] lg:bottom-6 lg:right-6 touch-none select-none"
          : "absolute inset-0 z-[70] overflow-y-auto bg-ink animate-[fadeIn_.2s_ease]"
      )}
      style={videoMini ? { transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` } : undefined}
      onPointerDown={onFloatDown}
      onPointerMove={onFloatMove}
      onPointerUp={onFloatUp}
      onPointerCancel={onFloatUp}
    >
      {/* Tree-stable player wrapper: preserves HLS/SHAKA/MP4 buffer across float <-> expand */}
      <div
        ref={wrapRef}
        className={cn(
          videoMini
            ? "glow-ring relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl"
            : "sticky top-0 z-20 mx-auto aspect-video w-full bg-black lg:max-w-[880px]"
        )}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          playsInline
          autoPlay
          poster={req.poster}
          controls={native && !videoMini}
          onContextMenu={(e) => e.preventDefault()}
        />

        {videoMini ? (
          <div className="absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-b from-black/75 via-transparent to-black/80 p-2">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setVideoMini(false)}
                aria-label="বড় করুন"
                title="বড় করুন"
                className="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-90 hover:bg-neon hover:text-ink"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <span className="truncate px-1 text-[10px] font-bold text-white/90">{req.title}</span>
              <button
                type="button"
                onClick={closePlayer}
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
              {req.live && <span className="rounded bg-live px-1.5 py-0.5 text-[9px] font-extrabold text-white">LIVE</span>}
              <button
                type="button"
                onClick={requestSystemPip}
                aria-label="সিস্টেম PiP"
                title="সিস্টেম PiP"
                className="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-90"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {native && (
              <div className="absolute inset-x-3 top-3 z-30 flex items-center justify-between pointer-events-none">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    closePlayer();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    closePlayer();
                  }}
                  aria-label="ফিরে যান"
                  className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/75 text-white backdrop-blur shadow-lg active:scale-90 hover:bg-black"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    minimizeToFloating();
                  }}
                  aria-label="ফ্লোটিং প্লেয়ার"
                  className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/75 text-white backdrop-blur shadow-lg active:scale-90 hover:bg-neon hover:text-ink"
                >
                  <PictureInPicture2 className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
            {status !== "error" && !native && (
              <Chrome
                title={req.title}
                subtitle={req.subtitle}
                live={req.live}
                playing={playing}
                loading={buffering}
                cur={cur}
                dur={dur}
                muted={muted}
                isFull={isFull}
                menuOpen={menuOpen}
                onBack={closePlayer}
                onMinimize={minimizeToFloating}
                onPip={requestSystemPip}
                onToggle={toggle}
                onSeek={(t) => videoRef.current && (videoRef.current.currentTime = t)}
                onMute={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)}
                onFullscreen={fullscreen}
                extras={extras}
              />
            )}
            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 text-center text-white">
                <TriangleAlert className="h-9 w-9 text-amber-400" />
                <p className="text-sm font-semibold">এই সার্ভারে ভিডিও চালানো যাচ্ছে না</p>
                <p className="text-[11px] text-white/70">অন্য সার্ভার বেছে নিন অথবা আবার চেষ্টা করুন।</p>
                {!native && (
                  <button
                    onClick={() => {
                      setNative(true);
                      setStep(0);
                      setTick((t) => t + 1);
                    }}
                    className="card-edge rounded-full bg-surface2 px-5 py-2 text-xs font-bold text-neon active:scale-95"
                  >
                    ডিফল্ট ব্রাউজার প্লেয়ারে চালান
                  </button>
                )}
                <button
                  onClick={() => {
                    setStep(0);
                    setTick((t) => t + 1);
                  }}
                  className="glow-soft flex items-center gap-2 rounded-full bg-neon px-5 py-2 text-xs font-bold text-ink active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> আবার চেষ্টা
                </button>
                {rawUrl && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={openExternal} className="card-edge flex items-center gap-1.5 rounded-full bg-surface2 px-4 py-2 text-[11px] font-bold text-neon active:scale-95">
                      {isAndroid || isIOS ? <ExternalLink className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {isAndroid ? "MX Player / VLC-এ চালান" : isIOS ? "VLC-এ চালান" : "VLC-এর জন্য লিংক কপি"}
                    </button>
                    <a href={rawUrl} target="_blank" rel="noopener noreferrer" download className="card-edge flex items-center gap-1.5 rounded-full bg-surface2 px-4 py-2 text-[11px] font-bold text-white active:scale-95">
                      <Download className="h-3.5 w-3.5" /> ডাউনলোড
                    </a>
                  </div>
                )}
                {isMkv && <p className="max-w-[300px] text-[10px] leading-snug text-white/60">MKV ফাইলের অডিও/ভিডিও কোডেক (HEVC, AC3, DTS) ব্রাউজার সাপোর্ট করে না — অন্য প্লেয়ারে চালালে ঠিকমতো চলবে।</p>}
                <button onClick={closePlayer} className="text-[11px] text-white/70 underline">
                  ফিরে যান
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!videoMini && (
        <>
          <div className="px-4 pt-4">
            <h1 className="text-[17px] font-extrabold leading-snug">{req.title}</h1>
            {req.subtitle && <p className="mt-0.5 text-xs text-mute">{req.subtitle}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={minimizeToFloating}
                className="card-edge flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface2 px-4 py-2 text-[11px] font-semibold text-neon active:scale-95"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" /> ফ্লোটিং মোডে দেখুন
              </button>
              <button
                onClick={() => setNative((n) => !n)}
                className="card-edge min-h-[40px] rounded-full bg-surface2 px-4 py-2 text-[11px] font-semibold text-mute hover:text-neon active:scale-95"
              >
                {native ? "কাস্টম কন্ট্রোলারে ফিরুন" : "ডিফল্ট ব্রাউজার প্লেয়ার"}
              </button>
            </div>
            {req.sources.length > 1 && (
              <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {req.sources.map((s, i) => (
                  <button
                    key={s.url + i}
                    onClick={() => setStep(attempts.findIndex((a) => a.si === i))}
                    className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-semibold active:scale-95", i === att.si ? "glow-soft bg-neon text-ink" : "card-edge bg-surface2 text-mute")}
                  >
                    {s.label}
                  </button>
                ))}
                <button onClick={nextServer} className="card-edge shrink-0 rounded-full bg-surface2 px-4 py-2 text-xs font-semibold text-neon active:scale-95">
                  পরের সার্ভার →
                </button>
              </div>
            )}
          </div>

          {req.related && <Related items={req.related} />}
        </>
      )}
    </div>
  );
}
