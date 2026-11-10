import { Heart } from "lucide-react";
import { useApp } from "../lib/store";
import type { Song } from "../lib/api";
import { Art, SongDownload } from "./MusicPlayer";
import { cn } from "../utils/cn";

export function SongRow({ song, list, i }: { song: Song; list: Song[]; i: number }) {
  const { current, playQueue, playing, isLiked, toggleLike } = useApp();
  const active = current?.id === song.id;
  return (
    <div onClick={() => playQueue(list, i)} className={cn("flex items-center gap-3 rounded-2xl px-2.5 py-2 active:bg-surface2", active && "bg-surface2")}>
      <div className="relative">
        <Art src={song.image} className="h-12 w-12 shrink-0 rounded-xl" />
        {active && playing && (
          <div className="absolute inset-0 flex items-end justify-center gap-[3px] rounded-xl bg-black/55 pb-3">
            {[0, 1, 2].map((n) => (
              <span key={n} className="eq-bar w-[3px] rounded bg-neon" style={{ animationDelay: `${n * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", active && "text-neon")}>{song.title}</p>
        <p className="truncate text-xs text-mute">{song.artist || song.album}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(song);
        }}
        className="grid h-9 w-9 place-items-center active:scale-90"
      >
        <Heart className={cn("h-[18px] w-[18px]", isLiked(song.id) ? "fill-live text-live" : "text-mute")} />
      </button>
      <SongDownload song={song} />
    </div>
  );
}
