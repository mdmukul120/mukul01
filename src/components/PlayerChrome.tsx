import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Maximize2, Minimize2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Spinner } from "./ui";
import { cn } from "../utils/cn";

export const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(sec).padStart(2, "0");
};

export function MenuButton({
  label,
  options,
  value,
  onPick,
  onOpen,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (id: string) => void;
  onOpen?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: boolean) => {
    setOpen(v);
    onOpen?.(v);
  };
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggle(!open);
        }}
        className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold backdrop-blur active:scale-95"
      >
        {label}
      </button>
      {open && (
        <div className="absolute bottom-10 right-0 z-30 max-h-48 min-w-[110px] overflow-y-auto rounded-2xl bg-ink/95 p-1.5 shadow-2xl card-edge">
          {options.map((o) => (
            <button
              key={o.id}
              onClick={(e) => {
                e.stopPropagation();
                onPick(o.id);
                toggle(false);
              }}
              className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold", o.id === value ? "text-neon" : "text-white/80")}
            >
              {o.label}
              {o.id === value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ChromeProps {
  title: string;
  subtitle?: string;
  live?: boolean;
  playing: boolean;
  loading: boolean;
  cur: number;
  dur: number;
  muted: boolean;
  isFull: boolean;
  onBack: () => void;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onMute: () => void;
  onFullscreen: () => void;
  extras?: ReactNode;
  menuOpen?: boolean;
}

/** Custom control overlay shared by the HLS/MP4 player and the YouTube player. */
export function Chrome(p: ChromeProps) {
  const [visible, setVisible] = useState(true);
  const [flash, setFlash] = useState<"" | "back" | "fwd">("");
  const hideT = useRef<number>(0);
  const tapT = useRef<number>(0);
  const lastTap = useRef({ t: 0, x: 0 });
  const canSeek = !p.live && isFinite(p.dur) && p.dur > 0;

  const wake = () => {
    setVisible(true);
    window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setVisible(false), 3200);
  };
  useEffect(() => {
    if (!p.playing || p.menuOpen) {
      window.clearTimeout(hideT.current);
      setVisible(true);
    } else wake();
    return () => window.clearTimeout(hideT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.playing, p.menuOpen]);

  const skip = (d: number) => {
    p.onSeek(Math.max(0, Math.min(p.dur || 1e9, p.cur + d)));
    setFlash(d < 0 ? "back" : "fwd");
    window.setTimeout(() => setFlash(""), 450);
  };

  const onSurface = (e: React.PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (now - lastTap.current.t < 300 && canSeek) {
      window.clearTimeout(tapT.current);
      skip(x < rect.width / 2 ? -10 : 10);
      lastTap.current.t = 0;
      return;
    }
    lastTap.current = { t: now, x };
    window.clearTimeout(tapT.current);
    tapT.current = window.setTimeout(() => (visible && p.playing ? setVisible(false) : wake()), canSeek ? 260 : 0);
  };

  const pct = canSeek ? Math.min(100, (p.cur / p.dur) * 100) : 100;

  return (
    <div className="absolute inset-0 select-none">
      <div className="absolute inset-0" onPointerUp={onSurface} />

      {flash && (
        <div className={cn("pointer-events-none absolute top-1/2 grid h-16 w-16 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-xs font-bold", flash === "back" ? "left-[14%]" : "right-[14%]")}>
          {flash === "back" ? "−10s" : "+10s"}
        </div>
      )}

      <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

        {/* top bar */}
        <div className={cn("absolute inset-x-0 top-0 flex items-center gap-3 px-3 pt-3", visible && "pointer-events-auto")}>
          <button onClick={p.onBack} className="grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur active:scale-90">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{p.title}</p>
            {p.subtitle && <p className="truncate text-[11px] text-white/60">{p.subtitle}</p>}
          </div>
          {p.live && (
            <span className="flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[10px] font-extrabold tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
            </span>
          )}
        </div>

        {/* center */}
        <div className={cn("absolute inset-0 flex items-center justify-center gap-8", visible && "pointer-events-auto")}>
          {canSeek && (
            <button onClick={() => skip(-10)} className="grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur active:scale-90">
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
          <button onClick={p.onToggle} className="glow-soft grid h-16 w-16 place-items-center rounded-full bg-neon text-ink active:scale-90">
            {p.loading ? <Spinner className="h-7 w-7 !text-ink" /> : p.playing ? <Pause className="h-7 w-7 fill-ink" /> : <Play className="ml-0.5 h-7 w-7 fill-ink" />}
          </button>
          {canSeek && (
            <button onClick={() => skip(10)} className="grid h-11 w-11 place-items-center rounded-full bg-black/45 backdrop-blur active:scale-90">
              <RotateCw className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* bottom */}
        <div className={cn("absolute inset-x-0 bottom-0 px-4 pb-3", visible && "pointer-events-auto")}>
          <div className="flex items-center gap-3">
            <span className="w-11 text-[11px] font-semibold tabular-nums">{p.live ? "LIVE" : fmtTime(p.cur)}</span>
            <input
              type="range"
              className="seek h-[5px] min-w-0 flex-1 disabled:opacity-60"
              min={0}
              max={canSeek ? p.dur : 1}
              step={0.5}
              value={canSeek ? p.cur : 1}
              disabled={!canSeek}
              style={{ ["--p" as any]: pct + "%" }}
              onChange={(e) => {
                wake();
                p.onSeek(Number(e.target.value));
              }}
            />
            <span className="w-11 text-right text-[11px] font-semibold tabular-nums text-white/70">{canSeek ? fmtTime(p.dur) : ""}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={p.onMute} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur active:scale-90">
              {p.muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
            </button>
            <div className="flex items-center gap-2">
              {p.extras}
              <button onClick={p.onFullscreen} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur active:scale-90">
                {p.isFull ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function toggleFullscreen(el: HTMLElement | null, onFail: () => void) {
  const d = document as any;
  const e = el as any;
  try {
    if (document.fullscreenElement || d.webkitFullscreenElement) {
      await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      (screen.orientation as any)?.unlock?.();
    } else if (e) {
      await (e.requestFullscreen?.() ?? e.webkitRequestFullscreen?.());
      try {
        await (screen.orientation as any)?.lock?.("landscape");
      } catch {
        /* unsupported */
      }
    }
  } catch {
    onFail();
  }
}
