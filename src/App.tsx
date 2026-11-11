import { useEffect, useRef, type ReactNode } from "react";
import { Clapperboard, CloudSun, Home as HomeIcon, Moon, Music2, PlayCircle, Sun, Trophy, Tv } from "lucide-react";
import { AppProvider, useApp, type Tab } from "./lib/store";
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import Live from "./pages/Live";
import Sports from "./pages/Sports";
import Music from "./pages/Music";
import YouTube from "./pages/YouTube";
import Weather from "./pages/Weather";
import Details from "./components/Details";
import VideoPlayer from "./components/VideoPlayer";
import { FullPlayer, MiniPlayer } from "./components/MusicPlayer";
import { cn } from "./utils/cn";

const ic = "h-[19px] w-[19px]";
const NAV: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "home", label: "হোম", icon: <HomeIcon className={ic} /> },
  { id: "movies", label: "মুভি", icon: <Clapperboard className={ic} /> },
  { id: "sports", label: "স্পোর্টস", icon: <Trophy className={ic} /> },
  { id: "live", label: "টিভি", icon: <Tv className={ic} /> },
  { id: "music", label: "মিউজিক", icon: <Music2 className={ic} /> },
  { id: "youtube", label: "ইউটিউব", icon: <PlayCircle className={ic} /> },
  { id: "weather", label: "ওয়েদার", icon: <CloudSun className={ic} /> },
];

function Shell() {
  const { tab, setTab, toastMsg, theme, toggleTheme } = useApp();
  const scroller = useRef<HTMLElement>(null);
  const visited = useRef<Set<Tab>>(new Set(["home"]));
  visited.current.add(tab);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  const pages: Record<Tab, ReactNode> = {
    home: <Home />,
    movies: <Movies />,
    sports: <Sports />,
    live: <Live />,
    music: <Music />,
    youtube: <YouTube />,
    weather: <Weather />,
  };

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[520px] flex-col sm:max-w-[700px] lg:max-w-[1040px] overflow-hidden app-bg shadow-2xl md:border-x md:border-line">
      {/* Floating Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "লাইট থিমে পরিবর্তন করুন" : "ডার্ক থিমে পরিবর্তন করুন"}
        aria-label="Theme toggle"
        className="absolute right-3.5 top-3.5 z-40 grid h-9 w-9 place-items-center rounded-full bg-surface2/85 text-neon backdrop-blur card-edge active:scale-90 transition hover:bg-surface2"
      >
        {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-emerald-600" />}
      </button>

      <main ref={scroller} className="relative z-0 flex-1 overflow-y-auto overscroll-contain">
        {(Object.keys(pages) as Tab[]).map((t) =>
          visited.current.has(t) ? (
            <div key={t} className={t === tab ? "block animate-[fadeIn_.25s_ease]" : "hidden"}>
              {pages[t]}
            </div>
          ) : null
        )}
      </main>

      <div className="relative z-30">
        <MiniPlayer />
        <nav className="flex items-center justify-around border-t border-line bg-surface/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl">
          {NAV.map((n) => {
            const active = n.id === tab;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-1 flex-col items-center gap-0.5 py-0.5 min-w-0">
                <span className={cn("grid h-7 w-10 place-items-center rounded-full transition-all duration-300", active ? "glow-soft bg-neon text-ink" : "text-mute")}>{n.icon}</span>
                <span className={cn("text-[9.5px] font-semibold truncate px-0.5", active ? "text-neon font-bold" : "text-mute")}>{n.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <Details />
      <FullPlayer />
      <VideoPlayer />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-28 z-[90] flex justify-center px-6 transition-all duration-300",
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}
      >
        <div className="glow-soft rounded-full bg-neon px-4 py-2 text-xs font-bold text-ink">{toastMsg}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
