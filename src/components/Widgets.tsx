import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Clapperboard,
  CloudSun,
  Droplets,
  Film,
  MapPin,
  Maximize2,
  Music2,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  SkipForward,
  Thermometer,
  Trophy,
  Tv,
  Wind,
} from "lucide-react";
import { fetchWeatherData } from "../lib/api";
import { useApp } from "../lib/store";
import { cn } from "../utils/cn";

interface WidgetWx {
  location: { name: string; country: string; localtime: string };
  current: {
    temp_c: number;
    feelslike_c: number;
    humidity: number;
    wind_kph: number;
    condition: { text: string; icon: string };
  };
  forecast?: {
    forecastday?: Array<{
      day?: { maxtemp_c: number; mintemp_c: number; daily_chance_of_rain: number };
    }>;
  };
}

const CITY_BN: Record<string, string> = {
  dhaka: "ঢাকা",
  chittagong: "চট্টগ্রাম",
  chattogram: "চট্টগ্রাম",
  sylhet: "সিলেট",
  rajshahi: "রাজশাহী",
  khulna: "খুলনা",
  barisal: "বরিশাল",
  rangpur: "রংপুর",
  mymensingh: "ময়মনসিংহ",
};

const COND_BN: Record<string, string> = {
  sunny: "রৌদ্রোজ্জ্বল",
  clear: "পরিষ্কার আকাশ",
  "partly cloudy": "আংশিক মেঘলা",
  cloudy: "মেঘলা আকাশ",
  overcast: "ঘন মেঘ",
  mist: "কুয়াশাচ্ছন্ন",
  fog: "ঘন কুয়াশা",
  "patchy rain possible": "হালকা বৃষ্টির সম্ভাবনা",
  "patchy rain nearby": "আশেপাশে বৃষ্টি",
  "light rain": "হালকা বৃষ্টি",
  "moderate rain": "মাঝারি বৃষ্টি",
  "heavy rain": "ভারী বৃষ্টি",
  "light drizzle": "গুঁড়ি গুঁড়ি বৃষ্টি",
  "thundery outbreaks possible": "বজ্রসহ বৃষ্টির সম্ভাবনা",
};

const toBn = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)] ?? d);

function bnCity(name?: string) {
  if (!name) return "ঢাকা";
  const key = name.trim().toLowerCase();
  return CITY_BN[key] || name;
}

function bnCond(text?: string) {
  if (!text) return "";
  return COND_BN[text.trim().toLowerCase()] || text;
}

export function AppWidget({ liveCount = 0 }: { liveCount?: number }) {
  const {
    setTab,
    req,
    videoPlaying,
    setVideoMini,
    toggleActiveVideo,
    ytWatch,
    ytPlaying,
    setYtMini,
    toggleActiveYt,
    current,
    playing,
    toggle,
    next,
    openFull,
    bgPlay,
  } = useApp();

  const hasVideo = !!req;
  const hasYt = !hasVideo && !!ytWatch;
  const hasMusic = !hasVideo && !hasYt && !!current;

  const tiles = [
    {
      id: "sports",
      label: "লাইভ ম্যাচ",
      sub: liveCount > 0 ? `${toBn(liveCount)}টি চলছে` : "খেলাধুলা",
      icon: Trophy,
      action: () => setTab("sports"),
      accent: liveCount > 0,
    },
    {
      id: "movie",
      label: "Mukul Movie",
      sub: "মুভি লাইব্রেরি",
      icon: Film,
      action: () => setTab("movies"),
    },
    {
      id: "drama",
      label: "মুকুল ড্রামা",
      sub: "নাটক ও সিরিজ",
      icon: Clapperboard,
      action: () => setTab("movies"),
    },
    {
      id: "tv",
      label: "লাইভ টিভি",
      sub: "টিভি চ্যানেল",
      icon: Tv,
      action: () => setTab("live"),
    },
    {
      id: "music",
      label: "মিউজিক",
      sub: "অডিও প্লেয়ার",
      icon: Music2,
      action: () => setTab("music"),
    },
    {
      id: "youtube",
      label: "ইউটিউব",
      sub: "Mukul Tube",
      icon: PlayCircle,
      action: () => setTab("youtube"),
    },
  ];

  return (
    <section
      aria-label="Mukul Plus অ্যাপ উইজেট"
      className="panel flex flex-col justify-between gap-3.5 rounded-[24px] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="glow-soft grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon text-ink">
            <Play className="h-4 w-4 fill-ink" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-bold tracking-tight">Mukul Plus উইজেট</h2>
            <p className="truncate text-[11px] text-mute">
              {bgPlay ? "ফ্লোটিং ও ব্যাকগ্রাউন্ড প্লে সক্রিয়" : "কুইক অ্যাপ কন্ট্রোলার"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-neon active:scale-95"
        >
          সেটিংস <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Live / Active Media Strip */}
      <div className="card-edge flex items-center gap-3 rounded-2xl bg-surface2/80 p-2.5">
        {hasVideo && req && (
          <>
            <button
              type="button"
              onClick={toggleActiveVideo}
              aria-label={videoPlaying ? "পজ" : "প্লে"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon text-ink active:scale-90"
            >
              {videoPlaying ? <Pause className="h-4.5 w-4.5 fill-ink" /> : <Play className="h-4.5 w-4.5 fill-ink pl-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold">{req.title}</p>
              <p className="truncate text-[10.5px] text-mute">{req.live ? "লাইভ স্ট্রিম চলছে" : req.subtitle || "ভিডিও প্লেয়ার"}</p>
            </div>
            <button
              type="button"
              onClick={() => setVideoMini(false)}
              aria-label="বড় করুন"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-neon active:scale-90"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </>
        )}

        {hasYt && ytWatch && (
          <>
            <button
              type="button"
              onClick={toggleActiveYt}
              aria-label={ytPlaying ? "পজ" : "প্লে"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon text-ink active:scale-90"
            >
              {ytPlaying ? <Pause className="h-4.5 w-4.5 fill-ink" /> : <Play className="h-4.5 w-4.5 fill-ink pl-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold">{ytWatch.title}</p>
              <p className="truncate text-[10.5px] text-mute">{ytWatch.channel || "Mukul Tube"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setYtMini(false);
                setTab("youtube");
              }}
              aria-label="বড় করুন"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-neon active:scale-90"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </>
        )}

        {hasMusic && current && (
          <>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "পজ" : "প্লে"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon text-ink active:scale-90"
            >
              {playing ? <Pause className="h-4.5 w-4.5 fill-ink" /> : <Play className="h-4.5 w-4.5 fill-ink pl-0.5" />}
            </button>
            <button type="button" onClick={openFull} className="min-w-0 flex-1 text-left">
              <p className="truncate text-[12.5px] font-bold">{current.title}</p>
              <p className="truncate text-[10.5px] text-mute">{current.artist}</p>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="পরের গান"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-neon active:scale-90"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </>
        )}

        {!hasVideo && !hasYt && !hasMusic && (
          <>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-neon">
              <Play className="h-4 w-4 fill-current" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold">সব চ্যানেল ও মিডিয়া প্রস্তুত</p>
              <p className="truncate text-[10.5px] text-mute">যেকোনো ভিডিও বা গান প্লে করে ফ্লোটিং মোডে দেখুন</p>
            </div>
          </>
        )}
      </div>

      {/* 6 Quick-launch Tiles */}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={t.action}
              className="card-edge flex min-h-[54px] flex-col items-start justify-center rounded-xl bg-surface2/60 px-2.5 py-2 text-left transition hover:bg-surface2 active:scale-95"
            >
              <div className="flex w-full items-center justify-between gap-1">
                <Icon className={cn("h-4 w-4 shrink-0", t.accent ? "text-live" : "text-neon")} />
              </div>
              <p className="mt-1 w-full truncate text-[11.5px] font-bold leading-tight">{t.label}</p>
              <p className="w-full truncate text-[9.5px] text-mute leading-tight">{t.sub}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function WeatherWidget() {
  const { defaultCity, setTab } = useApp();
  const [data, setData] = useState<WidgetWx | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(false);
    try {
      const res = await fetchWeatherData<WidgetWx>(defaultCity || "Dhaka");
      setData(res);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, [defaultCity]);

  useEffect(() => {
    load();
  }, [load]);

  const today = data?.forecast?.forecastday?.[0]?.day;
  const iconUrl = data?.current?.condition?.icon
    ? data.current.condition.icon.startsWith("//")
      ? `https:${data.current.condition.icon}`
      : data.current.condition.icon
    : "";

  return (
    <section
      aria-label="আবহাওয়া উইজেট"
      className="panel flex flex-col justify-between gap-3.5 rounded-[24px] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon/15 text-neon">
            <CloudSun className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 truncate text-[14px] font-bold tracking-tight">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-neon" />
              {bnCity(data?.location?.name || defaultCity)}
            </h2>
            <p className="truncate text-[11px] text-mute">আলাদা ওয়েদার উইজেট</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="রিফ্রেশ আবহাওয়া"
            className="grid h-9 w-9 place-items-center rounded-xl bg-surface2 text-mute hover:text-neon active:scale-90 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-neon")} />
          </button>
          <button
            type="button"
            onClick={() => setTab("weather")}
            className="flex min-h-[36px] items-center gap-1 rounded-xl bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-neon active:scale-95"
          >
            বিস্তারিত <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl bg-surface2/60 p-4">
          <div className="space-y-2 flex-1">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-surface2" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-surface2" />
          </div>
          <div className="h-14 w-14 animate-pulse rounded-2xl bg-surface2" />
        </div>
      ) : err && !data ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-surface2/60 p-4 text-center">
          <p className="text-xs text-mute">আবহাওয়ার তথ্য লোড করা যায়নি</p>
          <button type="button" onClick={load} className="rounded-xl bg-neon px-4 py-1.5 text-xs font-bold text-ink active:scale-95">
            আবার চেষ্টা
          </button>
        </div>
      ) : (
        data && (
          <>
            <button
              type="button"
              onClick={() => setTab("weather")}
              className="card-edge flex items-center justify-between gap-3 rounded-2xl bg-surface2/75 px-4 py-3 text-left transition hover:bg-surface2 active:scale-[0.99]"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums">
                    {toBn(Math.round(data.current.temp_c))}°
                  </span>
                  <span className="text-sm font-bold text-neon">C</span>
                </div>
                <p className="mt-1 truncate text-[12.5px] font-semibold">{bnCond(data.current.condition.text)}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-mute tabular-nums">
                  <Thermometer className="h-3 w-3 text-neon" />
                  অনুভূত {toBn(Math.round(data.current.feelslike_c))}°
                  {today ? ` · ${toBn(Math.round(today.mintemp_c))}°/${toBn(Math.round(today.maxtemp_c))}°` : ""}
                </p>
              </div>
              {iconUrl && (
                <img
                  src={iconUrl}
                  alt={data.current.condition.text}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 shrink-0 object-contain drop-shadow"
                />
              )}
            </button>

            <div className="grid grid-cols-3 gap-2">
              <div className="card-edge flex items-center gap-2 rounded-xl bg-surface2/60 px-2.5 py-2">
                <Droplets className="h-4 w-4 shrink-0 text-neon" />
                <div className="min-w-0">
                  <p className="text-[10px] text-mute truncate">আর্দ্রতা</p>
                  <p className="text-[12px] font-bold tabular-nums">{toBn(data.current.humidity)}%</p>
                </div>
              </div>
              <div className="card-edge flex items-center gap-2 rounded-xl bg-surface2/60 px-2.5 py-2">
                <Wind className="h-4 w-4 shrink-0 text-neon" />
                <div className="min-w-0">
                  <p className="text-[10px] text-mute truncate">বাতাস</p>
                  <p className="text-[12px] font-bold tabular-nums">{toBn(Math.round(data.current.wind_kph))} কিমি</p>
                </div>
              </div>
              <div className="card-edge flex items-center gap-2 rounded-xl bg-surface2/60 px-2.5 py-2">
                <CloudSun className="h-4 w-4 shrink-0 text-neon" />
                <div className="min-w-0">
                  <p className="text-[10px] text-mute truncate">বৃষ্টি</p>
                  <p className="text-[12px] font-bold tabular-nums">
                    {toBn(today?.daily_chance_of_rain ?? 0)}%
                  </p>
                </div>
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
}
