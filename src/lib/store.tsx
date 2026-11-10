import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { songUrl, type BongoItem, type CatalogMovie, type PlayRequest, type Song, type YtVideo } from "./api";

export type Tab = "home" | "movies" | "sports" | "live" | "music" | "youtube";

export type Detail =
  | { t: "ott"; slug: string }
  | { t: "catalog"; movie: CatalogMovie }
  | { t: "ctg"; id: number }
  | { t: "bongo"; item: BongoItem }
  | { t: "playlist"; id: string; name?: string; image?: string }
  | { t: "yt"; video: YtVideo; related?: YtVideo[] };

interface Ctx {
  tab: Tab;
  setTab: (t: Tab) => void;
  // video
  req: PlayRequest | null;
  play: (r: PlayRequest) => void;
  closePlayer: () => void;
  // detail stack
  detail: Detail | null;
  openDetail: (d: Detail) => void;
  closeDetail: () => void;
  // music
  queue: Song[];
  index: number;
  current: Song | null;
  playing: boolean;
  progress: number;
  duration: number;
  playQueue: (songs: Song[], idx: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  fullOpen: boolean;
  openFull: () => void;
  closeFull: () => void;
  quality: string;
  setQuality: (q: string) => void;
  liked: Song[];
  isLiked: (id: string) => boolean;
  toggleLike: (s: Song) => void;
  favCh: string[];
  toggleFavCh: (name: string) => void;
  toast: (m: string) => void;
  toastMsg: string;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : init;
    } catch {
      return init;
    }
  });
  const set = useCallback(
    (n: T) => {
      setV(n);
      try {
        localStorage.setItem(key, JSON.stringify(n));
      } catch {
        /* ignore */
      }
    },
    [key]
  );
  return [v, set];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>("home");
  const [req, setReq] = useState<PlayRequest | null>(null);
  const [details, setDetails] = useState<Detail[]>([]);
  const [fullOpen, setFull] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [quality, setQuality] = useLocal<string>("q", "160kbps");
  const [liked, setLiked] = useLocal<Song[]>("liked", []);
  const [favCh, setFavCh] = useLocal<string[]>("favch", []);

  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(-1);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 2600);
  }, []);

  // ── history-based back button handling ──
  const layers = useRef<string[]>([]);
  const reqOpen = useRef(false);
  reqOpen.current = !!req;
  const fullRef = useRef(false);
  fullRef.current = fullOpen;

  const pushLayer = (n: string) => {
    layers.current.push(n);
    try {
      history.pushState({ l: n }, "");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const h = () => {
      const top = layers.current.pop();
      if (top === "player") setReq(null);
      else if (top === "full") setFull(false);
      else if (top === "detail") setDetails((d) => d.slice(0, -1));
    };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  const play = useCallback((r: PlayRequest) => {
    audioRef.current?.pause();
    if (!reqOpen.current) pushLayer("player");
    setReq(r);
  }, []);
  const closePlayer = useCallback(() => {
    if (layers.current.includes("player")) history.back();
    else setReq(null);
  }, []);
  const openDetail = useCallback((d: Detail) => {
    pushLayer("detail");
    setDetails((s) => [...s, d]);
  }, []);
  const closeDetail = useCallback(() => {
    if (layers.current.includes("detail")) history.back();
    else setDetails((d) => d.slice(0, -1));
  }, []);
  const openFull = useCallback(() => {
    if (!fullRef.current) {
      pushLayer("full");
      setFull(true);
    }
  }, []);
  const closeFull = useCallback(() => {
    if (layers.current.includes("full")) history.back();
    else setFull(false);
  }, []);

  // ── audio engine ──
  const loadIndex = useCallback((i: number) => {
    const a = audioRef.current;
    const s = queueRef.current[i];
    if (!a || !s) return;
    indexRef.current = i;
    setIndex(i);
    a.src = songUrl(s, qualityRef.current);
    setProgress(0);
    a.play().catch(() => setPlaying(false));
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.title,
        artist: s.artist,
        album: s.album,
        artwork: s.image ? [{ src: s.image, sizes: "500x500", type: "image/jpeg" }] : [],
      });
    }
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    loadIndex((indexRef.current + 1) % q.length);
  }, [loadIndex]);
  const prev = useCallback(() => {
    const a = audioRef.current;
    const q = queueRef.current;
    if (!q.length) return;
    if (a && a.currentTime > 4) {
      a.currentTime = 0;
      return;
    }
    loadIndex((indexRef.current - 1 + q.length) % q.length);
  }, [loadIndex]);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setProgress(a.currentTime));
    a.addEventListener("durationchange", () => setDuration(a.duration || 0));
    a.addEventListener("play", () => setPlaying(true));
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("ended", () => next());
    a.addEventListener("error", () => {
      if (a.src) {
        setToastMsg("গানটি চালানো যাচ্ছে না, পরেরটি চালানো হচ্ছে…");
        window.setTimeout(() => setToastMsg(""), 2200);
        if (queueRef.current.length > 1) window.setTimeout(next, 600);
      }
    });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => a.play());
      navigator.mediaSession.setActionHandler("pause", () => a.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    }
    return () => {
      a.pause();
      a.src = "";
    };
  }, [next, prev]);

  const playQueue = useCallback(
    (songs: Song[], idx: number) => {
      queueRef.current = songs;
      setQueue(songs);
      loadIndex(idx);
    },
    [loadIndex]
  );
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    if (a.paused) a.play().catch(() => undefined);
    else a.pause();
  }, []);
  const seek = useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  const toggleLike = useCallback(
    (s: Song) => {
      if (liked.find((x) => x.id === s.id)) setLiked(liked.filter((x) => x.id !== s.id));
      else setLiked([s, ...liked]);
    },
    [liked, setLiked]
  );
  const toggleFavCh = useCallback(
    (name: string) => setFavCh(favCh.includes(name) ? favCh.filter((x) => x !== name) : [...favCh, name]),
    [favCh, setFavCh]
  );

  const value = useMemo<Ctx>(
    () => ({
      tab,
      setTab,
      req,
      play,
      closePlayer,
      detail: details[details.length - 1] || null,
      openDetail,
      closeDetail,
      queue,
      index,
      current: queue[index] || null,
      playing,
      progress,
      duration,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      fullOpen,
      openFull,
      closeFull,
      quality,
      setQuality,
      liked,
      isLiked: (id: string) => liked.some((s) => s.id === id),
      toggleLike,
      favCh,
      toggleFavCh,
      toast,
      toastMsg,
    }),
    [tab, req, details, queue, index, playing, progress, duration, fullOpen, quality, liked, favCh, toastMsg, play, closePlayer, openDetail, closeDetail, playQueue, toggle, next, prev, seek, openFull, closeFull, setQuality, toggleLike, toggleFavCh, toast]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}
