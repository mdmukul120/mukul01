import { useMemo, useState } from "react";
import { Dices, Play } from "lucide-react";
import type { RelatedItem } from "../lib/api";

export const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

/** "Lottery" list: same-category videos in random order, reshuffle on tap. */
export default function Related({ items, title = "আরও দেখুন" }: { items: RelatedItem[]; title?: string }) {
  const [seed, setSeed] = useState(0);
  const list = useMemo(() => shuffle(items), [items, seed]);
  if (!list.length) return null;
  return (
    <div className="px-4 pb-10 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[16px] font-bold">
          {title} <span className="text-sm text-mute">({list.length})</span>
        </h3>
        <button onClick={() => setSeed((n) => n + 1)} className="glow-soft flex items-center gap-1.5 rounded-full bg-neon px-3.5 py-2 text-xs font-extrabold text-ink active:scale-95">
          <Dices className="h-4 w-4" /> লটারি
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.slice(0, 30).map((r) => (
          <button key={r.key} onClick={r.open} className="text-left transition active:scale-[0.96]">
            <div className="card-edge relative aspect-video overflow-hidden rounded-[18px] bg-surface2">
              {r.image && <img src={r.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {r.live && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[9px] font-extrabold">
                  <span className="live-dot h-2 w-2 rounded-full bg-live" /> LIVE
                </span>
              )}
              <span className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-neon text-ink">
                <Play className="h-3 w-3 fill-ink" />
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 px-0.5 text-[12px] font-semibold leading-tight">{r.title}</p>
            {r.sub && <p className="truncate px-0.5 text-[10.5px] text-mute">{r.sub}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
