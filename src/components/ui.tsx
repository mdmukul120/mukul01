import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Play, RefreshCw, Search, X } from "lucide-react";
import { fmtStart, type SportMatch } from "../lib/api";
import { cn } from "../utils/cn";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message || "কিছু একটা সমস্যা হয়েছে"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data, error, loading, reload };
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin text-neon", className)} />;
}

export function Loading({ label = "লোড হচ্ছে…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-mute">
      <Spinner className="h-8 w-8" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry, hint }: { message?: string; onRetry?: () => void; hint?: string }) {
  return (
    <div className="panel mx-5 my-8 flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-live/15 text-live">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <p className="text-sm font-semibold">ডেটা লোড করা যায়নি</p>
      {message && <p className="break-words text-xs leading-relaxed text-mute">{message.replace(/<[^>]+>/g, "").slice(0, 200)}</p>}
      {hint && <p className="text-xs leading-relaxed text-amber-300/80">{hint}</p>}
      {onRetry && (
        <button onClick={onRetry} className="glow-soft mt-1 flex items-center gap-2 rounded-full bg-neon px-5 py-2 text-sm font-bold text-ink active:scale-95">
          <RefreshCw className="h-4 w-4" /> আবার চেষ্টা করুন
        </button>
      )}
    </div>
  );
}

export function Chips<T extends string | number>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto px-5 py-2.5", className)}>
      {items.map((i) => (
        <button
          key={String(i.id)}
          onClick={() => onChange(i.id)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition active:scale-95",
            value === i.id ? "glow-soft bg-neon text-ink" : "bg-surface2 text-mute card-edge"
          )}
        >
          {i.label}
          {i.count !== undefined && <span className="ml-1.5 text-[10px] opacity-70">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  suggestions,
  onSelectSuggestion,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  suggestions?: string[];
  onSelectSuggestion?: (s: string) => void;
}) {
  return (
    <div className="mx-5 space-y-2">
      <form
        className="card-edge flex items-center gap-2 rounded-full bg-surface px-4 py-3 focus-within:shadow-[inset_0_0_0_1.5px_var(--color-neon)]"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <Search className="h-4 w-4 shrink-0 text-neon" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text,#eef7f0)] outline-none placeholder:text-mute"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-mute p-1">
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      {suggestions && suggestions.length > 0 && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 text-xs">
          <span className="shrink-0 text-[10px] font-bold text-neon uppercase tracking-wider">সাজেশন:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                if (onSelectSuggestion) onSelectSuggestion(s);
                else onSubmit?.();
              }}
              className="card-edge shrink-0 rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-neon hover:border-neon transition active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrowBtn({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  const I = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button onClick={onClick} aria-label={dir === 1 ? "পরের" : "আগের"} className="card-edge grid h-11 w-11 place-items-center rounded-full bg-surface2 active:scale-90 active:bg-neon active:text-ink">
      <I className="h-5 w-5" />
    </button>
  );
}

export function Rail({
  title,
  count,
  dot,
  children,
}: {
  title: string;
  count?: number;
  dot?: "live" | "soon" | "none";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (d: 1 | -1) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="mt-8">
      <div className="mb-3.5 flex items-center justify-between px-5">
        <h2 className="flex items-center gap-2.5 text-[18px] font-bold tracking-tight">
          {dot === "live" && <span className="live-dot h-3 w-3 rounded-full bg-live" />}
          {dot === "soon" && <span className="h-3 w-3 rounded-full bg-neon" />}
          {title}
          {count !== undefined && <span>({count})</span>}
        </h2>
        <div className="flex gap-2.5">
          <ArrowBtn dir={-1} onClick={() => go(-1)} />
          <ArrowBtn dir={1} onClick={() => go(1)} />
        </div>
      </div>
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-5 pb-4 pt-1">
        {children}
      </div>
    </section>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3.5 px-5 text-[18px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function HRow({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar flex gap-3.5 overflow-x-auto px-5 pb-3">{children}</div>;
}

export function PosterCard({
  image,
  title,
  badge,
  sub,
  rating,
  onClick,
  className,
  premium,
}: {
  image?: string;
  title: string;
  badge?: string;
  sub?: string;
  rating?: number | string | null;
  onClick?: () => void;
  className?: string;
  premium?: boolean;
}) {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onClick} className={cn("w-full text-left transition active:scale-[0.96]", className)}>
      <div className="card-edge relative aspect-[2/3] w-full overflow-hidden rounded-[20px] bg-surface2">
        {image && !err ? (
          <img src={image} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center p-3 text-center text-xs text-mute">{title}</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        {badge && (
          <span className="absolute left-2 top-2 max-w-[80%] truncate rounded-full bg-ink/80 px-2 py-0.5 text-[9.5px] font-bold text-neon backdrop-blur">{badge}</span>
        )}
        {premium && <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-extrabold text-black">PRO</span>}
        {rating !== undefined && rating !== null && Number(rating) > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">★ {Number(rating).toFixed(1)}</span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 px-0.5 text-[12.5px] font-semibold leading-tight">{title}</p>
      {sub && <p className="mt-0.5 truncate px-0.5 text-[11px] text-mute">{sub}</p>}
    </button>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{children}</div>;
}

export function Skeletons({ n = 9 }: { n?: number }) {
  return (
    <Grid>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-[20px] bg-surface2" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-surface2" />
        </div>
      ))}
    </Grid>
  );
}

export function Sentinel({ onVisible, disabled }: { onVisible: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    if (disabled || !ref.current) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && cb.current(), { rootMargin: "400px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [disabled]);
  return <div ref={ref} className="h-8" />;
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between bg-ink/85 px-5 pb-2 pt-5 backdrop-blur-xl">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-mute">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line bg-surface/80 px-5 py-5 text-center text-[13px] text-mute">
      <p>Copyright © 2026 Mukul Plus. All Rights Reserved.</p>
      <p className="mt-1">
        Developed By: <span className="font-bold text-neon">Mukul</span>
      </p>
    </footer>
  );
}

/** Landscape match card (image-first, like the reference design). */
export function MatchTile({ m, onPlay, wide }: { m: SportMatch; onPlay: (m: SportMatch) => void; wide?: boolean }) {
  const live = m.status === "live";
  const [err, setErr] = useState(false);
  const t = fmtStart(m.start);
  return (
    <button
      onClick={() => onPlay(m)}
      className={cn(
        "card-edge relative aspect-[16/10] shrink-0 snap-start overflow-hidden rounded-[22px] bg-surface2 text-left transition active:scale-[0.96]",
        wide ? "w-full" : "w-[72%] max-w-[300px]"
      )}
    >
      {m.image && !err ? (
        <img src={m.image} alt={m.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-surface2 to-ink p-4 text-center text-sm font-bold">{m.title}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent" />
      {live ? (
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-2 py-1 text-[10px] font-extrabold text-white backdrop-blur">
          <span className="live-dot h-2.5 w-2.5 rounded-full bg-live" /> LIVE
        </span>
      ) : (
        t && <span className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-bold text-neon backdrop-blur">{t}</span>
      )}
      <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-bold">{m.title}</p>
          {m.league && <p className="truncate text-[10.5px] text-mute">{m.league}</p>}
        </div>
        <span className="glow-soft grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon text-ink">
          <Play className="h-3.5 w-3.5 fill-ink" />
        </span>
      </div>
    </button>
  );
}
