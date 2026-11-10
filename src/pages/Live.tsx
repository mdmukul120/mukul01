import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { liveChannels, type Channel } from "../lib/api";
import { useApp } from "../lib/store";
import { Chips, ErrorState, Loading, PageHeader, SearchBar, Sentinel, useAsync } from "../components/ui";
import { cn } from "../utils/cn";

export default function Live() {
  return (
    <div className="pb-8">
      <PageHeader title="লাইভ টিভি" subtitle="সব চ্যানেল এক জায়গায়" />
      <TV />
    </div>
  );
}

function ChannelLogo({ c }: { c: Channel }) {
  const [err, setErr] = useState(false);
  return (
    <div className="card-edge relative mx-auto aspect-square w-full overflow-hidden rounded-full bg-surface2">
      {c.logo && !err ? (
        // p-[15%] keeps the whole (rectangular) logo inside the circle's inscribed square
        <img
          src={c.logo}
          alt={c.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setErr(true)}
          className="absolute inset-0 h-full w-full object-contain p-[15%]"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center px-2 text-center text-[10px] font-bold leading-tight text-mute">{c.name.slice(0, 12)}</span>
      )}
    </div>
  );
}

function TV() {
  const { play, favCh, toggleFavCh } = useApp();
  const { data, error, loading, reload } = useAsync(liveChannels, []);
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(60);

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    data?.forEach((c) => m.set(c.group, (m.get(c.group) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const list = useMemo(() => {
    if (!data) return [];
    let l = data;
    if (group === "fav") l = l.filter((c) => favCh.includes(c.name));
    else if (group !== "all") l = l.filter((c) => c.group === group);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((c) => c.name.toLowerCase().includes(s));
    return l;
  }, [data, group, q, favCh]);

  useEffect(() => setLimit(60), [group, q]);

  const open = (c: Channel) => {
    const rel = (data || [])
      .filter((x) => x.group === c.group && x.url !== c.url)
      .map((x) => ({ key: x.url, title: x.name, sub: x.group, image: x.logo, live: true, open: () => open(x) }));
    play({
      title: c.name,
      subtitle: c.group,
      poster: c.logo,
      sources: [{ label: "লাইভ স্ট্রিম", url: c.url, hls: true }],
      live: true,
      related: rel,
    });
  };

const TV_SUGGESTIONS = [
  "Somoy",
  "Jamuna",
  "Channel i",
  "Ekushey",
  "T Sports",
  "Gazi",
  "ATN",
  "NTV",
  "BTV",
  "News",
  "Sports",
];

  return (
    <>
      <SearchBar
        value={q}
        onChange={setQ}
        placeholder={`${data ? data.length : ""} চ্যানেল থেকে খুঁজুন…`}
        suggestions={TV_SUGGESTIONS}
        onSelectSuggestion={(s) => setQ(s)}
      />
      <Chips
        value={group}
        onChange={setGroup}
        items={[
          { id: "all", label: "সব", count: data?.length },
          { id: "fav", label: "♥ প্রিয়", count: favCh.length },
          ...groups.map(([g, n]) => ({ id: g, label: g, count: n })),
        ]}
      />
      {loading && <Loading label="চ্যানেল লোড হচ্ছে…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && list.length === 0 && (
        <p className="py-16 text-center text-sm text-mute">{group === "fav" ? "কোনো প্রিয় চ্যানেল নেই — কার্ডের ♥ চাপুন" : "কিছু পাওয়া যায়নি"}</p>
      )}
      <div className="mt-1 grid grid-cols-4 gap-x-2.5 gap-y-4 px-3 sm:gap-x-4 sm:px-5 lg:grid-cols-6 xl:grid-cols-8">
        {list.slice(0, limit).map((c) => (
          <div key={c.id} className="relative min-w-0">
            <button onClick={() => open(c)} className="block w-full text-left transition active:scale-95">
              <ChannelLogo c={c} />
              <p className="mt-1.5 line-clamp-2 break-words text-center text-[10.5px] font-medium leading-tight text-white/90 sm:text-[11.5px]">{c.name}</p>
            </button>
            <button
              onClick={() => toggleFavCh(c.name)}
              aria-label="প্রিয়"
              className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-full bg-ink/80 backdrop-blur"
            >
              <Heart className={cn("h-3 w-3", favCh.includes(c.name) ? "fill-live text-live" : "text-white/70")} />
            </button>
            {c.url.startsWith("http://") && <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded bg-amber-500/90 px-1 text-[7px] font-bold leading-tight text-black">HTTP</span>}
          </div>
        ))}
      </div>
      {list.length > limit && <Sentinel onVisible={() => setLimit((l) => l + 60)} />}
    </>
  );
}

