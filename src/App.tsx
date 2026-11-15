import { useEffect, useRef, type ReactNode } from "react";
import { Clapperboard, CloudSun, Home as HomeIcon, Music2, Play, PlayCircle, Settings as SettingsIcon, Trophy, Tv } from "lucide-react";
import { AppProvider, useApp, type Tab } from "./lib/store";
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import Live from "./pages/Live";
import Sports from "./pages/Sports";
import Music from "./pages/Music";
import YouTube from "./pages/YouTube";
import Weather from "./pages/Weather";
import Settings from "./pages/Settings";
import Details from "./components/Details";
import VideoPlayer from "./components/VideoPlayer";
import YtWatchOverlay from "./components/YtWatchOverlay";
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
  { id: "settings", label: "সেটিংস", icon: <SettingsIcon className={ic} /> },
];

function Shell() {
  const { tab, setTab, toastMsg } = useApp();
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
    settings: <Settings />,
  };

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-full lg:max-w-[1360px] overflow-hidden app-bg shadow-2xl lg:border-x lg:border-line">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-line bg-surface/90 px-3 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-3">
          <span className="glow-soft grid h-10 w-10 place-items-center rounded-xl bg-neon text-ink">
            <Play className="h-5 w-5 fill-ink" />
          </span>
          <span className="text-[20px] font-extrabold tracking-tight whitespace-nowrap">
            Mukul <span className="text-neon">Plus</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto" aria-label="প্রধান মেনু">
          {NAV.map((n) => {
            const active = n.id === tab;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={cn(
                  "flex min-h-[46px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition whitespace-nowrap",
                  active ? "glow-soft bg-neon text-ink font-bold" : "text-mute hover:bg-surface2"
                )}
              >
                {n.icon}
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area + Mobile Bottom Bar */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
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
          <nav
            aria-label="বটম নেভিগেশন"
            className="no-scrollbar flex items-center justify-between overflow-x-auto border-t border-line bg-surface/95 px-1.5 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl lg:hidden"
          >
            {NAV.map((n) => {
              const active = n.id === tab;
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className="flex min-h-[46px] min-w-[46px] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 px-1 py-0.5"
                >
                  <span className={cn("grid h-7 w-10 place-items-center rounded-full transition-all duration-300", active ? "glow-soft bg-neon text-ink" : "text-mute")}>
                    {n.icon}
                  </span>
                  <span className={cn("whitespace-nowrap text-[9.5px] font-semibold leading-tight", active ? "text-neon font-bold" : "text-mute")}>
                    {n.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <Details />
        <FullPlayer />
        <VideoPlayer />
        <YtWatchOverlay />

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-28 z-[90] flex justify-center px-6 transition-all duration-300",
            toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          <div className="glow-soft rounded-full bg-neon px-4 py-2 text-xs font-bold text-ink">{toastMsg}</div>
        </div>
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
