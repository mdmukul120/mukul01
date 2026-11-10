import { useState } from "react";
import { Play } from "lucide-react";
import { musicPlaylists, musicSongs, type PlaylistCard } from "../lib/api";
import { useApp } from "../lib/store";
import { Chips, ErrorState, HRow, Loading, PageHeader, SearchBar, Section, useAsync } from "../components/ui";
import { Art } from "../components/MusicPlayer";
import { SongRow } from "../components/SongRow";

const SECTIONS: [string, string][] = [
  ["Hindi top hits", "🔥 হিন্দি টপ হিটস"],
  ["Bengali hits", "💙 বাংলা গান"],
  ["Arijit Singh", "🎤 অরিজিৎ সিং"],
  ["Romantic", "💞 রোমান্টিক"],
  ["Punjabi", "🕺 পাঞ্জাবি"],
  ["Lofi chill", "🌙 লোফি ও চিল"],
];

function PlaylistTile({ p }: { p: PlaylistCard }) {
  const { openDetail } = useApp();
  return (
    <button onClick={() => openDetail({ t: "playlist", id: p.id, name: p.name, image: p.image })} className="w-36 shrink-0 text-left active:scale-95 transition">
      <Art src={p.image} className="aspect-square w-full rounded-2xl card-edge" />
      <p className="mt-2 line-clamp-2 text-[12.5px] font-semibold leading-tight">{p.name}</p>
      {p.songCount ? <p className="text-[11px] text-mute">{p.songCount} গান</p> : null}
    </button>
  );
}

function Explore() {
  const { playQueue } = useApp();
  const { data, loading, error, reload } = useAsync(async () => {
    const [songs, ...pls] = await Promise.allSettled([
      musicSongs("Bangla Hindi top hits 2026", 20),
      ...SECTIONS.map(([q]) => musicPlaylists(q, 12)),
    ]);
    if (songs.status === "rejected" && pls.every((p) => p.status === "rejected")) throw songs.reason;
    return {
      songs: songs.status === "fulfilled" ? songs.value : [],
      lists: pls.map((p) => (p.status === "fulfilled" ? p.value : [])),
    };
  }, []);
  return (
    <>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          {SECTIONS.map(([, title], i) =>
            data.lists[i].length ? (
              <Section key={title} title={title}>
                <HRow>
                  {data.lists[i].map((p) => (
                    <PlaylistTile key={p.id} p={p} />
                  ))}
                </HRow>
              </Section>
            ) : null
          )}
          {data.songs.length > 0 && (
            <Section title="⭐ জনপ্রিয় গান">
              <div className="px-2">
                {data.songs.map((s, i) => (
                  <SongRow key={s.id} song={s} list={data.songs} i={i} />
                ))}
              </div>
              <div className="mt-2 flex justify-center">
                <button onClick={() => playQueue(data.songs, 0)} className="flex items-center gap-2 rounded-full glow-soft bg-neon px-6 py-2.5 text-sm font-bold text-ink active:scale-95">
                  <Play className="h-4 w-4 fill-ink" /> সব চালান
                </button>
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}

function SearchResults({ q }: { q: string }) {
  const [mode, setMode] = useState<"songs" | "pl">("songs");
  const songs = useAsync(() => musicSongs(q, 40), [q]);
  const pls = useAsync(() => musicPlaylists(q, 20), [q]);
  return (
    <>
      <Chips
        value={mode}
        onChange={setMode}
        items={[
          { id: "songs", label: "গান", count: songs.data?.length },
          { id: "pl", label: "প্লেলিস্ট", count: pls.data?.length },
        ]}
      />
      {mode === "songs" && (
        <div className="px-2">
          {songs.loading && <Loading />}
          {songs.error && <ErrorState message={songs.error} onRetry={songs.reload} />}
          {songs.data?.length === 0 && <p className="py-12 text-center text-sm text-mute">কোনো গান পাওয়া যায়নি</p>}
          {songs.data?.map((s, i) => (
            <SongRow key={s.id} song={s} list={songs.data!} i={i} />
          ))}
        </div>
      )}
      {mode === "pl" && (
        <div className="grid grid-cols-2 gap-4 px-5 sm:grid-cols-3 lg:grid-cols-4">
          {pls.loading && <div className="col-span-2"><Loading /></div>}
          {pls.error && <div className="col-span-2"><ErrorState message={pls.error} onRetry={pls.reload} /></div>}
          {pls.data?.map((p) => (
            <div key={p.id} className="[&>button]:w-full">
              <PlaylistTile p={p} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const MUSIC_SUGGESTIONS = [
  "Arijit Singh",
  "Shreya Ghoshal",
  "Anupam Roy",
  "বাংলা গান",
  "হিন্দি হিটস",
  "Lofi chill",
  "রোমান্টিক",
  "পাঞ্জাবি",
  "রক গান",
];

export default function Music() {
  const { liked } = useApp();
  const [tab, setTab] = useState<"explore" | "liked">("explore");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  return (
    <div className="pb-6">
      <PageHeader title="মিউজিক" subtitle="গান শুনুন ও ডাউনলোড করুন" />
      <SearchBar
        value={input}
        onChange={(v) => {
          setInput(v);
          if (!v) setQ("");
        }}
        onSubmit={() => setQ(input.trim())}
        placeholder="গান, শিল্পী বা অ্যালবাম খুঁজুন…"
        suggestions={MUSIC_SUGGESTIONS}
        onSelectSuggestion={(s) => {
          setInput(s);
          setQ(s);
        }}
      />
      {q ? (
        <SearchResults q={q} />
      ) : (
        <>
          <Chips
            value={tab}
            onChange={setTab}
            items={[
              { id: "explore", label: "এক্সপ্লোর" },
              { id: "liked", label: "♥ পছন্দের", count: liked.length },
            ]}
          />
          {tab === "explore" ? (
            <Explore />
          ) : (
            <div className="px-2">
              {liked.length === 0 && <p className="py-16 text-center text-sm text-mute">গানের ♥ চাপলে এখানে জমা হবে</p>}
              {liked.map((s, i) => (
                <SongRow key={s.id} song={s} list={liked} i={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
