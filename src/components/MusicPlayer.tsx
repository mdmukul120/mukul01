import { ChevronDown, Download, Heart, ListMusic, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useApp } from "../lib/store";
import { downloadFile, fmtTime, songUrl, type Song } from "../lib/api";
import { cn } from "../utils/cn";

export function Art({ src, className }: { src?: string; className?: string }) {
  return src ? (
    <img src={src} alt="" referrerPolicy="no-referrer" className={cn("object-cover", className)} />
  ) : (
    <div className={cn("grid place-items-center bg-gradient-to-br from-surface2 to-line", className)}>
      <ListMusic className="h-1/2 w-1/2 text-neon" />
    </div>
  );
}

export function MiniPlayer() {
  const { current, playing, toggle, next, openFull, progress, duration, fullOpen } = useApp();
  if (!current || fullOpen) return null;
  const pct = duration ? (progress / duration) * 100 : 0;
  return (
    <div className="px-2 pb-1.5">
      <div
        onClick={openFull}
        className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface2/95 p-2 pr-3 shadow-xl shadow-black/50 backdrop-blur-xl"
      >
        <Art src={current.image} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{current.title}</p>
          <p className="truncate text-[11px] text-mute">{current.artist}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-neon text-ink active:scale-90"
        >
          {playing ? <Pause className="h-5 w-5 fill-ink" /> : <Play className="h-5 w-5 fill-ink pl-0.5" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="grid h-9 w-9 place-items-center text-white/80 active:scale-90"
        >
          <SkipForward className="h-5 w-5 fill-current" />
        </button>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
          <div className="h-full bg-neon" style={{ width: pct + "%" }} />
        </div>
      </div>
    </div>
  );
}

export function SongDownload({ song, className }: { song: Song; className?: string }) {
  const { toast, quality } = useApp();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toast("ডাউনলোড শুরু হচ্ছে…");
        downloadFile(songUrl(song, quality === "12kbps" ? "160kbps" : "320kbps"), `${song.title} - ${song.artist}.m4a`).then(
          (ok) => !ok && toast("ডাউনলোড করা যায়নি")
        );
      }}
      className={cn("grid h-9 w-9 place-items-center rounded-full text-mute active:scale-90", className)}
      aria-label="ডাউনলোড"
    >
      <Download className="h-[18px] w-[18px]" />
    </button>
  );
}

export function FullPlayer() {
  const { current, queue, index, playing, toggle, next, prev, seek, progress, duration, fullOpen, closeFull, isLiked, toggleLike, playQueue, quality, setQuality } = useApp();
  if (!fullOpen || !current) return null;
  const QUALS = ["96kbps", "160kbps", "320kbps"];
  return (
    <div className="absolute inset-0 z-[65] flex flex-col overflow-hidden bg-ink animate-[slideUp_.28s_ease]">
      {current.image && (
        <img src={current.image} referrerPolicy="no-referrer" alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-ink/80 to-ink" />
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <button onClick={closeFull} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 active:scale-90">
            <ChevronDown className="h-6 w-6" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-mute">এখন চলছে</p>
          <SongDownload song={current} className="bg-white/10 text-white" />
        </div>

        <div className="mx-auto mt-6 aspect-square w-full max-w-[300px]">
          <Art
            src={current.image}
            className={cn(
              "h-full w-full rounded-[2rem] shadow-2xl shadow-black/70 transition-transform duration-500",
              playing ? "scale-100" : "scale-90"
            )}
          />
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{current.title}</h2>
            <p className="truncate text-sm text-white/55">{current.artist}</p>
          </div>
          <button onClick={() => toggleLike(current)} className="active:scale-90">
            <Heart className={cn("h-6 w-6", isLiked(current.id) ? "fill-live text-live" : "text-neon")} />
          </button>
        </div>

        <div className="mt-5">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            className="seek w-full"
            style={{ ["--p" as string]: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
          <div className="mt-1 flex justify-between text-[11px] text-mute">
            <span>{fmtTime(progress)}</span>
            <span>{fmtTime(duration || current.duration)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-7">
          <button onClick={prev} className="active:scale-90">
            <SkipBack className="h-8 w-8 fill-white" />
          </button>
          <button onClick={toggle} className="grid h-[72px] w-[72px] place-items-center rounded-full glow-soft bg-neon text-ink active:scale-90">
            {playing ? <Pause className="h-8 w-8 fill-ink" /> : <Play className="h-8 w-8 fill-ink pl-1" />}
          </button>
          <button onClick={next} className="active:scale-90">
            <SkipForward className="h-8 w-8 fill-white" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="text-[11px] text-mute">কোয়ালিটি:</span>
          {QUALS.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                quality === q ? "bg-neon text-ink" : "bg-surface2 text-mute"
              )}
            >
              {q.replace("kbps", "")}
            </button>
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] text-white/30">পরের গান থেকে কার্যকর হবে</p>

        {queue.length > 1 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">পরবর্তী গান</p>
            <div className="space-y-1">
              {queue.map((s, i) => (
                <button
                  key={s.id + i}
                  onClick={() => playQueue(queue, i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2 text-left",
                    i === index ? "bg-white/10" : "active:bg-white/5"
                  )}
                >
                  <Art src={s.image} className="h-10 w-10 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[13px] font-medium", i === index && "text-neon")}>{s.title}</p>
                    <p className="truncate text-[11px] text-mute">{s.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
