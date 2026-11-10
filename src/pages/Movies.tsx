import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bongoScrape,
  CTG_LIBS,
  ctgImg,
  ctgList,
  ctgSearch,
  ctgTitle,
  ottCategories,
  ottList,
  ottSearch,
} from "../lib/api";
import { useApp } from "../lib/store";
import { Chips, ErrorState, Grid, Loading, PageHeader, PosterCard, SearchBar, Sentinel, Skeletons, useAsync } from "../components/ui";
import { cn } from "../utils/cn";

function usePaged<T>(fetchPage: (p: number) => Promise<T[]>, key: string, idOf: (t: T) => string | number) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const page = useRef(1);
  const busy = useRef(false);
  const gen = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const g = gen.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetchRef.current(page.current);
      if (g !== gen.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map(idOf));
        return [...prev, ...r.filter((x) => !seen.has(idOf(x)))];
      });
      page.current += 1;
      if (!r.length) setDone(true);
    } catch (e: any) {
      if (g === gen.current) setError(e?.message || "লোড করা যায়নি");
    } finally {
      if (g === gen.current) {
        busy.current = false;
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gen.current += 1;
    busy.current = false;
    page.current = 1;
    setItems([]);
    setDone(false);
    setError("");
    load();
  }, [key, load]);

  return { items, loading, error, done, load };
}

type Src = "ott" | "ctg" | "bongo";

export default function Movies() {
  const [src, setSrc] = useState<Src>("ott");
  return (
    <div className="pb-6">
      <PageHeader title="মুভি ও সিরিজ" subtitle="সিনেমা, নাটক, ওয়েব সিরিজ" />
      <div className="px-5 pt-1">
        <div className="grid grid-cols-3 card-edge rounded-full bg-surface p-1.5">
          {(
            [
              ["ott", "Mukul Plus"],
              ["ctg", "CTGHall"],
              ["bongo", "Bongo"],
            ] as [Src, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSrc(id)}
              className={cn(
                "rounded-full py-2.5 text-[13px] font-bold transition",
                src === id ? "glow-soft bg-neon text-ink" : "text-mute"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        {src === "ott" && <OttBrowse />}
        {src === "ctg" && <CtgBrowse />}
        {src === "bongo" && <BongoBrowse />}
      </div>
    </div>
  );
}

function OttBrowse() {
  const { openDetail } = useApp();
  const [cat, setCat] = useState("");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data: cats } = useAsync(ottCategories, []);

  const { items, loading, error, done, load } = usePaged(
    (p) => (query ? (p === 1 ? ottSearch(query) : Promise.resolve([])) : ottList(p, cat || undefined)),
    `${cat}|${query}`,
    (x) => x.slug
  );

  useEffect(() => {
    if (!input) setQuery("");
  }, [input]);

  return (
    <>
      <SearchBar value={input} onChange={setInput} onSubmit={() => setQuery(input.trim())} placeholder="মুভি, সিরিজ বা নাটক খুঁজুন…" />
      {!query && (
        <Chips
          value={cat}
          onChange={setCat}
          items={[{ id: "", label: "সব" }, ...(cats || []).map((c) => ({ id: c.slug, label: c.bnName && /[\u0980-\u09FF]/.test(c.bnName) ? c.bnName : c.name }))]}
        />
      )}
      {query && <p className="px-5 pt-3 text-xs text-mute">“{query}” এর ফলাফল</p>}
      <div className="mt-2">
        {items.length === 0 && loading && <Skeletons />}
        {error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && items.length === 0 && <p className="py-16 text-center text-sm text-mute">কিছু পাওয়া যায়নি</p>}
        <Grid>
          {items.map((m) => (
            <PosterCard
              key={m.slug}
              image={m.poster}
              title={m.title}
              badge={m.kind === "movie" ? m.quality_tag || m.language : m.quality_tag?.slice(0, 22) || m.kind}
              sub={[m.year, m.language].filter(Boolean).join(" • ")}
              onClick={() => openDetail({ t: "ott", slug: m.slug })}
            />
          ))}
        </Grid>
        {items.length > 0 && loading && <Loading />}
        {!done && !error && items.length > 0 && !query && <Sentinel onVisible={load} disabled={loading} />}
      </div>
    </>
  );
}

function CtgBrowse() {
  const { openDetail } = useApp();
  const [lib, setLib] = useState(1);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { items, loading, error, done, load } = usePaged(
    async (p) => {
      if (query) return p === 1 ? await ctgSearch(query) : [];
      return (await ctgList(lib, p)).data;
    },
    `${lib}|${query}`,
    (x) => x.id
  );
  useEffect(() => {
    if (!input) setQuery("");
  }, [input]);
  return (
    <>
      <SearchBar value={input} onChange={setInput} onSubmit={() => setQuery(input.trim())} placeholder="CTGHall-এ মুভি খুঁজুন…" />
      {!query && <Chips value={lib} onChange={setLib} items={CTG_LIBS.map((l) => ({ id: l.id, label: l.name }))} />}
      <div className="mt-2">
        {items.length === 0 && loading && <Skeletons />}
        {error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && items.length === 0 && <p className="py-16 text-center text-sm text-mute">কিছু পাওয়া যায়নি</p>}
        <Grid>
          {items.map((m) => (
            <PosterCard
              key={m.id}
              image={ctgImg(m.poster_path)}
              title={ctgTitle(m.title)}
              sub={m.year ? String(m.year) : m.Library?.name}
              rating={m.online_rating}
              onClick={() => openDetail({ t: "ctg", id: m.id })}
            />
          ))}
        </Grid>
        {items.length > 0 && loading && <Loading />}
        {!done && !error && items.length > 0 && !query && <Sentinel onVisible={load} disabled={loading} />}
      </div>
    </>
  );
}

function BongoBrowse() {
  const { openDetail } = useApp();
  const { data, error, loading, reload } = useAsync(bongoScrape, []);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(60);

  const items = useMemo(() => {
    if (!data) return [];
    const all = cat === "all" ? data.flatMap((c) => c.items) : data.find((c) => c.key === cat)?.items || [];
    const seen = new Set<string>();
    const uniq = all.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    const s = q.trim().toLowerCase();
    return s ? uniq.filter((i) => i.title.toLowerCase().includes(s)) : uniq;
  }, [data, cat, q]);

  useEffect(() => setLimit(60), [cat, q]);

  return (
    <>
      <SearchBar value={q} onChange={setQ} placeholder="Bongo কনটেন্ট খুঁজুন…" />
      {data && <Chips value={cat} onChange={setCat} items={[{ id: "all", label: "সব" }, ...data.map((c) => ({ id: c.key, label: c.title.split("·")[0].trim(), count: c.items.length }))]} />}
      <div className="mt-2">
        {loading && <Skeletons />}
        {error && <ErrorState message={error} onRetry={reload} />}
        <Grid>
          {items.slice(0, limit).map((m) => (
            <PosterCard
              key={m.id}
              image={m.thumbnail}
              title={m.title}
              badge={m.category}
              premium={m.premium}
              onClick={() => openDetail({ t: "bongo", item: m })}
            />
          ))}
        </Grid>
        {items.length > limit && <Sentinel onVisible={() => setLimit((l) => l + 60)} />}
      </div>
    </>
  );
}
