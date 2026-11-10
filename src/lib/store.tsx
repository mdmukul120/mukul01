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
  theme: "dark" | "light";
  toggleTheme: () => void;
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

  // ── Theme Management ──
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("mukul_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* ignore */
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("mukul_theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // ── history-based back button handling ──
  const reqRef = useRef<PlayRequest | null>(null);
  reqRef.current = req;
  const detailsRef = useRef<Detail[]>([]);
  detailsRef.current = details;
  const fullRef = useRef(false);
  fullRef.current = fullOpen;
  const tabRef = useRef<Tab>("home");
  tabRef.current = tab;
  const lastBack = useRef(0);

  // Keep browser history seeded so back button does not exit the app abruptly
  useEffect(() => {
    try {
      if (!history.state || !history.state.mukul) {
        history.replaceState({ mukul: true, level: 0 }, "");
      }
    } catch {
      /* ignore */
    }

    const onBack = (e: Event) => {
      e.preventDefault?.();
      // 1. If video player is open -> close it
      if (reqRef.current) {
        setReq(null);
        try {
          history.pushState({ mukul: true }, "");
        } catch {}
        return;
      }
      // 2. If details modal is open -> close the top-most detail
      if (detailsRef.current.length > 0) {
        setDetails((d) => d.slice(0, -1));
        try {
          history.pushState({ mukul: true }, "");
        } catch {}
        return;
      }
      // 3. If full music player is open -> minimize it
      if (fullRef.current) {
        setFull(false);
        try {
          history.pushState({ mukul: true }, "");
        } catch {}
        return;
      }
      // 4. If not on home tab -> return to home tab
      if (tabRef.current !== "home") {
        setTab("home");
        try {
          history.pushState({ mukul: true }, "");
        } catch {}
        return;
      }
      // 5. On home tab: require double press to exit
      const now = Date.now();
      if (now - lastBack.current < 2200) {
        // user pressed twice within 2.2s, allow default exit
        return;
      }
      lastBack.current = now;
      toast("অ্যাপ থেকে বের হতে আবার ব্যাক চাপুন");
      try {
        history.pushState({ mukul: true }, "");
      } catch {}
    };

    window.addEventListener("popstate", onBack);
    document.addEventListener("backbutton", onBack as any);

    let capHandle: any = null;
    try {
      import("@capacitor/app")
        .then(({ App: CapApp }) => {
          CapApp.addListener("backButton", () => {
            onBack({ preventDefault: () => {} } as any);
          }).then((h) => {
            capHandle = h;
          });
        })
        .catch(() => {});
    } catch {}

    return () => {
      window.removeEventListener("popstate", onBack);
      document.removeEventListener("backbutton", onBack as any);
      capHandle?.remove?.();
    };
  }, [toast]);

  const play = useCallback((r: PlayRequest) => {
    audioRef.current?.pause();
    try {
      history.pushState({ mukul: true, type: "video" }, "");
    } catch {}
    setReq(r);
  }, []);

  const closePlayer = useCallback(() => {
    setReq(null);
  }, []);

  const openDetail = useCallback((d: Detail) => {
    try {
      history.pushState({ mukul: true, type: "detail" }, "");
    } catch {}
    setDetails((s) => [...s, d]);
  }, []);

  const closeDetail = useCallback(() => {
    setDetails((d) => d.slice(0, -1));
  }, []);

  const openFull = useCallback(() => {
    try {
      history.pushState({ mukul: true, type: "full" }, "");
    } catch {}
    setFull(true);
  }, []);

  const closeFull = useCallback(() => {
    setFull(false);
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
      theme,
      toggleTheme,
    }),
    [tab, req, details, queue, index, playing, progress, duration, fullOpen, quality, liked, favCh, toastMsg, theme, toggleTheme, play, closePlayer, openDetail, closeDetail, playQueue, toggle, next, prev, seek, openFull, closeFull, setQuality, toggleLike, toggleFavCh, toast]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}
