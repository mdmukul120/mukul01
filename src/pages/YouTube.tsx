import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Search, X } from "lucide-react";
import { fmtDuration, fmtViews, timeAgo, ytIdFromUrl, ytList, type YtVideo } from "../lib/api";
import { useApp } from "../lib/store";
import "./yt.css";

/* [id, label, search query]  — "" query = trending (all kinds of videos) */
const CATS: [string, string, string][] = [
  ["all", "সব", ""],
  ["live", "লাইভ", "live stream লাইভ"],
  ["music", "গান", "বাংলা গান new bangla song"],
  ["sports", "খেলাধুলা", "sports highlights recent match"],
  ["cricket", "ক্রিকেট", "cricket highlights recent match"],
  ["football", "ফুটবল", "football highlights recent match goal"],
  ["movie", "মুভি", "বাংলা মুভি movie trailer full movie"],
  ["natok", "নাটক", "বাংলা নাটক natok"],
  ["news", "খবর", "বাংলা খবর news today"],
  ["comedy", "কমেডি", "funny comedy bangla"],
  ["gaming", "গেমিং", "gaming gameplay"],
  ["tech", "টেক", "tech review bangla smartphone"],
  ["food", "রান্না", "রান্নার রেসিপি recipe"],
  ["islamic", "ইসলামিক", "ইসলামিক ওয়াজ waz"],
  ["edu", "শিক্ষা", "শিক্ষা education bangla"],
  ["travel", "ভ্রমণ", "travel vlog bangladesh"],
];

const PLACEHOLDER_TITLE = "YouTube ভিডিও";
const initial = (s: string) => (s.trim()[0] || "M").toUpperCase();
const statLine = (v: YtVideo) =>
  [v.views ? `${fmtViews(v.views)} ভিউ` : "", v.published ? timeAgo(v.published) : ""].filter(Boolean).join(" · ");

/* ───────────────────────── cards ───────────────────────── */
function Thumb({ v }: { v: YtVideo }) {
  return (
    <div className="yt-thumb">
      {v.thumb ? <img src={v.thumb} alt="" loading="lazy" /> : null}
      <div className="yt-hoverplay">
        <span>
          <Play size={22} fill="currentColor" />
        </span>
      </div>
      {v.live ? <span className="yt-live">LIVE</span> : v.duration ? <span className="yt-dur">{fmtDuration(v.duration)}</span> : null}
    </div>
  );
}

function Card({ v, onOpen }: { v: YtVideo; onOpen: (v: YtVideo) => void }) {
  return (
    <button className="yt-card" onClick={() => onOpen(v)} aria-label={v.title}>
      <Thumb v={v} />
      <div className="yt-meta">
        <div className="yt-ava">{initial(v.channel)}</div>
        <div className="yt-txt">
          <div className="yt-title clamp2">{v.title}</div>
          <div className="yt-sub">
            {v.channel}
            {statLine(v) ? <br /> : null}
            {statLine(v)}
          </div>
        </div>
      </div>
    </button>
  );
}

const Skeletons = ({ n = 6 }: { n?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="yt-card yt-skel" aria-hidden>
        <div className="yt-thumb" />
        <div className="yt-meta">
          <div className="yt-ava" />
          <div className="yt-txt" style={{ flex: 1 }}>
            <div className="l" style={{ width: "92%" }} />
            <div className="l" style={{ width: "55%" }} />
          </div>
        </div>
      </div>
    ))}
  </>
);

/* ───────────────────────── home / browse page ───────────────────────── */
export default function YouTube() {
  const { ytWatch, ytMini, setYtWatch } = useApp();
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState("all");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<YtVideo[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const expanded = !!(ytWatch && !ytMini);
  const gen = useRef(0);
  const busy = useRef(false);

  const query = useMemo(() => q || CATS.find((c) => c[0] === cat)?.[2] || "", [q, cat]);

  const load = useCallback(
    async (token?: string) => {
      if (busy.current) return;
      busy.current = true;
      const g = gen.current;
      setLoading(true);
      setError("");
      try {
        const r = await ytList(query, token);
        if (g !== gen.current) return;
        setItems((prev) => {
          const seen = new Set(token ? prev.map((x) => x.id) : []);
          return [...(token ? prev : []), ...r.items.filter((x) => !seen.has(x.id))];
        });
        setNext(r.next);
      } catch (e: any) {
        if (g === gen.current) setError(e?.message || "লোড করা যায়নি");
      } finally {
        busy.current = false;
        if (g === gen.current) setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    gen.current += 1;
    busy.current = false;
    setItems([]);
    setNext(null);
    load();
  }, [load]);

  // infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || expanded || !next || loading || error) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) load(next);
      },
      { rootMargin: "500px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [next, loading, error, expanded, load]);

  const scrollTop = () => root.current?.closest("main")?.scrollTo({ top: 0 });
  const show = (v: YtVideo) => {
    setYtWatch(v);
    scrollTop();
  };

  const submit = () => {
    const t = input.trim();
    if (!t) return setQ("");
    const id = ytIdFromUrl(t);
    if (id && (t.includes("/") || t.includes("="))) return show({ id, title: PLACEHOLDER_TITLE, channel: "", thumb: "" });
    setQ(t);
    scrollTop();
  };
  const clear = () => {
    setInput("");
    setQ("");
  };
  const pickCat = (id: string) => {
    setCat(id);
    setQ("");
    setInput("");
    scrollTop();
  };

  return (
    <div className="yt" ref={root}>
      <header className="yt-top">
        <div className="yt-bar">
          <div className="yt-logo">
            <i>
              <Play size={14} fill="currentColor" />
            </i>
            <b>
              Mukul <span>Tube</span>
            </b>
          </div>
          <form
            className="yt-search"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="yt-search-in">
              <input
                type="text"
                value={input}
                placeholder="ভিডিও সার্চ করুন বা লিংক দিন"
                onChange={(e) => {
                  setInput(e.target.value);
                  if (!e.target.value) setQ("");
                }}
                aria-label="সার্চ"
              />
              {input && (
                <button type="button" className="clr" onClick={clear} aria-label="মুছুন">
                  <X size={16} />
                </button>
              )}
            </div>
            <button type="submit" className="go" aria-label="সার্চ">
              <Search size={17} />
            </button>
          </form>
        </div>
        <div className="yt-chips">
          {CATS.map(([id, label]) => (
            <button key={id} className={"yt-chip" + (!q && cat === id ? " on" : "")} onClick={() => pickCat(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {q && (
        <div className="yt-head">
          <div>
            “{q}” <span>এর ফলাফল</span>
          </div>
          <button onClick={clear}>মুছুন</button>
        </div>
      )}

      <div className="yt-grid">
        {items.map((v) => (
          <Card key={v.id} v={v} onOpen={show} />
        ))}
        {loading && <Skeletons n={items.length ? 3 : 6} />}
        {!loading && !error && items.length === 0 && <div className="yt-msg">কোনো ভিডিও পাওয়া যায়নি!</div>}
        {error && (
          <div className="yt-msg">
            <p>{error.replace(/<[^>]+>/g, "").slice(0, 220)}</p>
            <p>
              <b>YouTube Data API v3 চালু আছে কিনা এবং কোটা শেষ হয়েছে কিনা দেখুন।</b>
            </p>
            <button className="yt-btn pri" onClick={() => load()}>
              আবার চেষ্টা করুন
            </button>
          </div>
        )}
      </div>

      <div ref={sentinel} className="yt-sentinel" />
      {next && !loading && !error && (
        <div className="yt-more">
          <button className="yt-btn" onClick={() => load(next)}>
            আরও ভিডিও
          </button>
        </div>
      )}
    </div>
  );
}
