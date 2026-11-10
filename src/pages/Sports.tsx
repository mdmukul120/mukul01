import { useState } from "react";
import { Play } from "lucide-react";
import { loadSports, type Highlight, type SportMatch } from "../lib/api";
import { makeSports } from "../lib/related";
import { useApp } from "../lib/store";
import { Chips, ErrorState, Loading, MatchTile, PageHeader, Rail, useAsync } from "../components/ui";

function HlCard({ h, wide, onPlay }: { h: Highlight; wide?: boolean; onPlay: (h: Highlight) => void }) {
  return (
    <button onClick={() => onPlay(h)} className={`${wide ? "w-full" : "w-[72%] max-w-[300px] shrink-0 snap-start"} text-left active:scale-[0.96] transition`}>
      <div className="card-edge relative aspect-video overflow-hidden rounded-[22px] bg-surface2">
        {h.thumbnail && <img src={h.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="glow-soft absolute bottom-2.5 left-2.5 grid h-9 w-9 place-items-center rounded-full bg-neon text-ink">
          <Play className="h-4 w-4 fill-ink" />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 px-1 text-[12.5px] font-semibold leading-tight">{h.title}</p>
    </button>
  );
}

export default function Sports() {
  const { play, toast } = useApp();
  const { data, error, loading, reload } = useAsync(loadSports, []);
  const [filter, setFilter] = useState("all");

  const live = data?.matches.filter((m) => m.status === "live") || [];
  const upcoming = data?.matches.filter((m) => m.status !== "live") || [];
  const hl = data?.highlights || [];

  const groups = new Map<string, Highlight[]>();
  hl.forEach((h) => groups.set(h.rail, [...(groups.get(h.rail) || []), h]));

  const S = data ? makeSports(data, play, toast) : null;
  const playMatch = (m: SportMatch) => S?.playMatch(m);
  const playHl = (h: Highlight) => S?.playHighlight(h);

  const showLive = filter === "all" || filter === "live";
  const showUp = filter === "all" || filter === "upcoming";
  const showHl = filter === "all" || filter === "hl";

  return (
    <div className="pb-8">
      <PageHeader title="স্পোর্টস" subtitle="লাইভ ম্যাচ, আসন্ন খেলা ও হাইলাইটস" />
      <Chips
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all", label: "সব" },
          { id: "live", label: "লাইভ", count: live.length },
          { id: "upcoming", label: "আসন্ন", count: upcoming.length },
          { id: "hl", label: "হাইলাইটস", count: hl.length },
        ]}
      />
      {loading && <Loading label="ম্যাচ লোড হচ্ছে…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          {showLive &&
            (live.length ? (
              <Rail title="লাইভ ম্যাচসমূহ" count={live.length} dot="live">
                {live.map((m) => (
                  <MatchTile key={m.id} m={m} onPlay={playMatch} />
                ))}
              </Rail>
            ) : (
              filter === "live" && <p className="panel mx-5 mt-6 rounded-2xl p-5 text-center text-sm text-mute">এখন কোনো লাইভ ম্যাচ নেই</p>
            ))}

          {showUp && upcoming.length > 0 && (
            <Rail title="আসন্ন ম্যাচসমূহ" count={upcoming.length} dot="soon">
              {upcoming.map((m) => (
                <MatchTile key={m.id} m={m} onPlay={playMatch} />
              ))}
            </Rail>
          )}

          {showHl && (
            <>
              {data.highlightsError && <ErrorState message="হাইলাইটস ফিড লোড হয়নি" onRetry={reload} />}
              {!data.highlightsError && hl.length === 0 && <p className="panel mx-5 mt-6 rounded-2xl p-5 text-center text-sm text-mute">এখনো কোনো হাইলাইটস নেই</p>}
              {filter === "hl" ? (
                [...groups.entries()].map(([rail, list]) => (
                  <section key={rail} className="mt-7">
                    <h2 className="mb-3.5 px-5 text-[18px] font-bold">
                      {rail} <span>({list.length})</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-5 sm:grid-cols-3 lg:grid-cols-4">
                      {list.map((h) => (
                        <HlCard key={h.id + h.sources[0].url} h={h} wide onPlay={playHl} />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                [...groups.entries()].map(([rail, list]) => (
                  <Rail key={rail} title={groups.size === 1 ? "হাইলাইটস" : rail} count={list.length}>
                    {list.map((h) => (
                      <HlCard key={h.id + h.sources[0].url} h={h} onPlay={playHl} />
                    ))}
                  </Rail>
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
