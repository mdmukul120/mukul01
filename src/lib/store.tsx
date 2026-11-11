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

export type Tab = "home" | "movies" | "sports" | "live" | "music" | "youtube" | "weather";
export type Theme = "dark" | "light";

export type Detail =
  | { t: "catalog"; movie: CatalogMovie }
  | { t: "ctg"; id: number }
  | { t: "bongo"; item: BongoItem }
  | { t: "playlist"; id: string; name?: string; image?: string }
  | { t: "yt"; video: YtVideo; related?: YtVideo[] };

interface Ctx {
  tab: Tab;
  setTab: (t: Tab) => void;
  // theme
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  // video player
  req: PlayRequest | null;
  play: (r: PlayRequest) => void;
  closePlayer: () => void;
  // youtube watch mode (for back button support)
  ytWatch: YtVideo | null;
  setYtWatch: (v: YtVideo | null) => void;
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
  const [tab, setTabState] = useState<Tab>("home");
  const [req, setReq] = useState<PlayRequest | null>(null);
  const [ytWatch, setYtWatch] = useState<YtVideo | null>(null);
  const [details, setDetails] = useState<Detail[]>([]);
  const [fullOpen, setFull] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [quality, setQuality] = useLocal<string>("q", "160kbps");
  const [liked, setLiked] = useLocal<Song[]>("liked", []);
  const [favCh, setFavCh] = useLocal<string[]>("favch", []);

  // Theme management with localStorage persistence
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("app_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* ignore */
    }
    return "dark";
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("app_theme", t);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", t === "dark");
      document.documentElement.classList.toggle("light", t === "light");
      document.documentElement.setAttribute("data-theme", t);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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

  // ── references for back-button handling ──
  const reqRef = useRef<PlayRequest | null>(null);
  reqRef.current = req;
  const ytWatchRef = useRef<YtVideo | null>(null);
  ytWatchRef.current = ytWatch;
  const fullRef = useRef(false);
  fullRef.current = fullOpen;
  const detailsRef = useRef<Detail[]>([]);
  detailsRef.current = details;
  const tabRef = useRef<Tab>("home");
  tabRef.current = tab;
  const lastBackPress = useRef<number>(0);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
  }, []);

  // Initialize browser history entry so Android back button can be intercepted
  useEffect(() => {
    try {
      history.replaceState({ app: true, depth: 0 }, "");
      history.pushState({ app: true, depth: 1 }, "");
    } catch {
      /* ignore */
    }

    const onPop = () => {
      // 1. Exit fullscreen if active
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.())?.catch(() => undefined);
        history.pushState({ app: true, depth: 1 }, "");
        return;
      }

      // 2. Video Player modal open -> close it
      if (reqRef.current) {
        setReq(null);
        history.pushState({ app: true, depth: 1 }, "");
        return;
      }

      // 3. YouTube Watch modal open -> close it
      if (ytWatchRef.current) {
        setYtWatch(null);
        history.pushState({ app: true, depth: 1 }, "");
        return;
      }

      // 4. Music Full Player open -> close it
      if (fullRef.current) {
        setFull(false);
        history.pushState({ app: true, depth: 1 }, "");
        return;
      }

      // 5. Details modal open -> pop top item
      if (detailsRef.current.length > 0) {
        setDetails((d) => d.slice(0, -1));
        history.pushState({ app: true, depth: 1 }, "");
        return;
      }

      // 6. If currently on any sub-tab (movies, sports, tv, music, youtube, weather), go to home
      if (tabRef.current !== "home") {
        setTabState("home");
        history.pushState({ app: true, depth: 1 }, "");
        return;
      }

      // 7. On home tab with nothing open: require double tap within 2.5s to exit
      const now = Date.now();
      if (now - lastBackPress.current < 2500) {
        // Allow app exit
        return;
      }
      lastBackPress.current = now;
      toast("অ্যাপ বন্ধ করতে আবার ব্যাক চাপুন");
      history.pushState({ app: true, depth: 1 }, "");
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [toast]);

  const play = useCallback((r: PlayRequest) => {
    audioRef.current?.pause();
    setReq(r);
  }, []);

  const closePlayer = useCallback(() => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.())?.catch(() => undefined);
    }
    setReq(null);
  }, []);

  const openDetail = useCallback((d: Detail) => {
    setDetails((s) => [...s, d]);
  }, []);

  const closeDetail = useCallback(() => {
    setDetails((d) => d.slice(0, -1));
  }, []);

  const openFull = useCallback(() => {
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
      theme,
      setTheme,
      toggleTheme,
      req,
      play,
      closePlayer,
      ytWatch,
      setYtWatch,
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
    [
      tab,
      theme,
      req,
      ytWatch,
      details,
      queue,
      index,
      playing,
      progress,
      duration,
      fullOpen,
      quality,
      liked,
      favCh,
      toastMsg,
      setTab,
      setTheme,
      toggleTheme,
      play,
      closePlayer,
      openDetail,
      closeDetail,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      openFull,
      closeFull,
      setQuality,
      toggleLike,
      toggleFavCh,
      toast,
    ]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}
