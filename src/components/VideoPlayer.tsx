import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { ArrowLeft, Copy, Download, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { useApp } from "../lib/store";
import { isHlsUrl, isMkvUrl, streamUrl, type PlaySource } from "../lib/api";
import { cn } from "../utils/cn";
import { Chrome, MenuButton } from "./PlayerChrome";
import Related from "./Related";

interface Attempt {
  si: number;
  url: string;
  hls: boolean;
  native: boolean;
}

/** Per server: direct → native HLS → same-origin proxy (fixes CORS / http / hotlink problems). */
function buildAttempts(sources: PlaySource[]): Attempt[] {
  const out: Attempt[] = [];
  sources.forEach((s, si) => {
    const hls = !!s.hls || isHlsUrl(s.url);
    if (!s.url.startsWith("http://")) {
      if (hls) {
        out.push({ si, url: s.url, hls, native: false });
        out.push({ si, url: s.url, hls, native: true });
      } else out.push({ si, url: s.url, hls, native: true });
    }
    out.push({ si, url: streamUrl(s.url), hls, native: !hls });
  });
  return out;
}

export default function VideoPlayer() {
  const { req, closePlayer, toast } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
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
  // "native" = the browser's own <video controls> (how it worked before the custom controller).
  const [native, setNative] = useState(false);
  const nativeRef = useRef(false);
  nativeRef.current = native;

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
  }, [req]);

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
    let dead = false;

    const fail = () => {
      if (dead) return;
      if (step < attempts.length - 1) {
        if (attempts[step + 1].si !== att.si) toast("পরবর্তী সার্ভারে চেষ্টা করা হচ্ছে…");
        setStep(step + 1);
      } else setStatus("error");
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

    v.addEventListener("playing", ready);
    v.addEventListener("playing", onPlay);
    v.addEventListener("loadeddata", ready);
    v.addEventListener("canplay", ready);
    v.addEventListener("error", fail);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("volumechange", onVol);
    v.addEventListener("waiting", onWait);
    v.addEventListener("ended", onEnded);

    if (att.hls && !att.native && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(att.url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
        setLevels([...new Set(d.levels.map((l) => l.height).filter(Boolean))].sort((a, b) => b - a));
        v.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hls) hls.recoverMediaError();
        else fail();
      });
    } else {
      hlsRef.current = null;
      v.src = att.url;
      v.play().catch(() => undefined);
    }

    // slow servers / big MKV files need time to load metadata — never time out in native mode,
    // and otherwise only give up when the browser has stopped loading altogether.
    const timer = window.setTimeout(() => {
      if (dead || nativeRef.current) return;
      if (v.readyState < 2 && v.networkState !== 2) fail();
    }, 40000);

    return () => {
      dead = true;
      window.clearTimeout(timer);
      v.removeEventListener("playing", ready);
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("loadeddata", ready);
      v.removeEventListener("canplay", ready);
      v.removeEventListener("error", fail);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("volumechange", onVol);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("ended", onEnded);
      hls?.destroy();
      hlsRef.current = null;
      v.removeAttribute("src");
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, req, tick]);

  if (!req || !att) return null;

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  };
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
  // original (non-proxied) link, for opening in VLC / MX Player when the browser can't decode the file
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
        () => window.open(rawUrl, "_blank")
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
    <div className="absolute inset-0 z-[70] overflow-y-auto bg-ink animate-[fadeIn_.2s_ease]">
      {/* full-bleed player, pinned while the list scrolls */}
      <div ref={wrapRef} className="sticky top-0 z-20 mx-auto aspect-video w-full bg-black lg:max-w-[880px]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          playsInline
          autoPlay
          poster={req.poster}
          controls={native}
          onContextMenu={(e) => e.preventDefault()}
        />
        {native && (
          <button
            type="button"
            onClick={closePlayer}
            className="absolute left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/75 text-white shadow-lg backdrop-blur active:scale-90 hover:bg-black"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
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
            onToggle={toggle}
            onSeek={(t) => videoRef.current && (videoRef.current.currentTime = t)}
            onMute={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)}
            onFullscreen={fullscreen}
            extras={extras}
          />
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 text-center">
            <TriangleAlert className="h-9 w-9 text-amber-400" />
            <p className="text-sm font-semibold">এই সার্ভারে ভিডিও চালানো যাচ্ছে না</p>
            <p className="text-[11px] text-mute">অন্য সার্ভার বেছে নিন অথবা আবার চেষ্টা করুন।</p>
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
            {isMkv && <p className="max-w-[300px] text-[10px] leading-snug text-mute">MKV ফাইলের অডিও/ভিডিও কোডেক (HEVC, AC3, DTS) ব্রাউজার সাপোর্ট করে না — অন্য প্লেয়ারে চালালে ঠিকমতো চলবে।</p>}
            <button onClick={closePlayer} className="text-[11px] text-mute underline">
              ফিরে যান
            </button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <h1 className="text-[17px] font-extrabold leading-snug">{req.title}</h1>
        {req.subtitle && <p className="mt-0.5 text-xs text-mute">{req.subtitle}</p>}
        <button
          onClick={() => setNative((n) => !n)}
          className="card-edge mt-3 rounded-full bg-surface2 px-4 py-2 text-[11px] font-semibold text-neon active:scale-95"
        >
          {native ? "কাস্টম কন্ট্রোলারে ফিরুন" : "ডিফল্ট ব্রাউজার প্লেয়ার"}
        </button>
        {req.sources.length > 1 && (
          <>
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
          </>
        )}
      </div>

      {req.related && <Related items={req.related} />}
    </div>
  );
}
