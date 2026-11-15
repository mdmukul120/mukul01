import { useState } from "react";
import { Check, LayoutGrid, MapPin, Moon, Music2, PictureInPicture2, ShieldCheck, Smartphone, Sun, Trash2, Zap } from "lucide-react";
import { clearApiCache } from "../lib/api";
import { useApp, type Theme } from "../lib/store";
import { Footer, PageHeader } from "../components/ui";
import { cn } from "../utils/cn";

const AUDIO_QUALITIES = [
  { id: "96kbps", label: "৯৬ kbps", desc: "ডেটা সেভার" },
  { id: "160kbps", label: "১৬০ kbps", desc: "স্ট্যান্ডার্ড" },
  { id: "320kbps", label: "৩২০ kbps", desc: "হাই-ফিডেলিটি" },
];

const CITIES = [
  { id: "Dhaka", label: "ঢাকা" },
  { id: "Chittagong", label: "চট্টগ্রাম" },
  { id: "Sylhet", label: "সিলেট" },
  { id: "Rajshahi", label: "রাজশাহী" },
  { id: "Khulna", label: "খুলনা" },
  { id: "Barisal", label: "বরিশাল" },
  { id: "Rangpur", label: "রংপুর" },
  { id: "Mymensingh", label: "ময়মনসিংহ" },
];

export default function Settings() {
  const {
    theme,
    setTheme,
    quality,
    setQuality,
    defaultCity,
    setDefaultCity,
    bgPlay,
    setBgPlay,
    showWidgets,
    setShowWidgets,
    liked,
    favCh,
    clearFavorites,
    toast,
  } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    toast(t === "dark" ? "ডার্ক থিম সক্রিয় হয়েছে" : "লাইট থিম সক্রিয় হয়েছে");
  };

  const handleClearCache = () => {
    clearApiCache();
    toast("অ্যাপ ক্যাশ পরিষ্কার হয়েছে");
  };

  const handleResetSaved = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearFavorites();
    setConfirmClear(false);
    toast("সংরক্ষিত তালিকা রিসেট হয়েছে");
  };

  return (
    <div className="pb-10">
      <PageHeader title="সেটিংস" subtitle="থিম, প্লেব্যাক ও অ্যাপ প্রিফারেন্স" />

      <div className="mx-auto max-w-4xl space-y-8 px-5 pt-4">
        {/* Theme & Appearance Section */}
        <section aria-labelledby="sec-theme">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 id="sec-theme" className="text-[17px] font-bold tracking-tight">
                অ্যাপ থিম ও ডিসপ্লে
              </h2>
              <p className="mt-0.5 text-xs text-mute">আপনার পছন্দমতো ডার্ক বা লাইট থিম বেছে নিন (স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকে)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => pickTheme("dark")}
              aria-pressed={theme === "dark"}
              className={cn(
                "group relative flex items-center gap-4 rounded-2xl p-4 text-left transition active:scale-[0.98] min-h-[84px]",
                theme === "dark" ? "glow-ring bg-surface" : "card-edge bg-surface hover:bg-surface2"
              )}
            >
              <div className="relative flex h-14 w-14 shrink-0 flex-col justify-between overflow-hidden rounded-xl border border-[#1b3323] bg-[#040a06] p-2">
                <div className="flex items-center justify-between">
                  <span className="h-2 w-5 rounded-sm bg-[#2ee83f]" />
                  <Moon className="h-3.5 w-3.5 text-[#2ee83f]" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-sm bg-[#112017]" />
                  <div className="h-1.5 w-2/3 rounded-sm bg-[#112017]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold">ডার্ক মোড</span>
                  {theme === "dark" && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-neon text-ink">
                      <Check className="h-3.5 w-3.5 stroke-[2.8]" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-snug text-mute">চোখের আরামের জন্য গভীর গাঢ় সবুজ ও নিওন অ্যাকসেন্ট</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => pickTheme("light")}
              aria-pressed={theme === "light"}
              className={cn(
                "group relative flex items-center gap-4 rounded-2xl p-4 text-left transition active:scale-[0.98] min-h-[84px]",
                theme === "light" ? "glow-ring bg-surface" : "card-edge bg-surface hover:bg-surface2"
              )}
            >
              <div className="relative flex h-14 w-14 shrink-0 flex-col justify-between overflow-hidden rounded-xl border border-[#c8e6d0] bg-[#f4f9f5] p-2">
                <div className="flex items-center justify-between">
                  <span className="h-2 w-5 rounded-sm bg-[#16a34a]" />
                  <Sun className="h-3.5 w-3.5 text-[#16a34a]" />
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-sm bg-[#d9efe0]" />
                  <div className="h-1.5 w-2/3 rounded-sm bg-[#d9efe0]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold">লাইট মোড</span>
                  {theme === "light" && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-neon text-ink">
                      <Check className="h-3.5 w-3.5 stroke-[2.8]" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-snug text-mute">দিনের আলোয় স্পষ্ট পাঠযোগ্য উজ্জ্বল সাদা ও সবুজ ক্যানভাস</p>
              </div>
            </button>
          </div>
        </section>

        <div className="border-t border-line" />

        {/* Audio & Weather Preferences */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-labelledby="sec-media">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <Music2 className="h-4 w-4 text-neon" />
              <h2 id="sec-media" className="text-[16px] font-bold">
                মিউজিক অডিও কোয়ালিটি
              </h2>
            </div>
            <div className="card-edge grid grid-cols-3 gap-1.5 rounded-2xl bg-surface p-1.5">
              {AUDIO_QUALITIES.map((q) => {
                const active = quality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setQuality(q.id);
                      toast(`অডিও কোয়ালিটি ${q.label} সেট হয়েছে`);
                    }}
                    className={cn(
                      "flex min-h-[48px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition active:scale-95",
                      active ? "glow-soft bg-neon text-ink" : "text-mute hover:bg-surface2"
                    )}
                  >
                    <span className="text-[13px] font-bold tabular-nums">{q.label}</span>
                    <span className={cn("text-[10px]", active ? "text-ink/80 font-semibold" : "text-mute")}>{q.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-neon" />
              <h2 className="text-[16px] font-bold">ডিফল্ট আবহাওয়ার শহর</h2>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CITIES.map((c) => {
                const active = defaultCity.toLowerCase() === c.id.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setDefaultCity(c.id);
                      toast(`ডিফল্ট শহর ${c.label} সেট হয়েছে`);
                    }}
                    className={cn(
                      "min-h-[44px] rounded-xl px-2 py-2 text-xs font-semibold transition active:scale-95 truncate",
                      active ? "glow-soft bg-neon text-ink font-bold" : "card-edge bg-surface text-mute hover:text-neon"
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="border-t border-line" />

        {/* Floating, Background Play & Home Widgets */}
        <section aria-labelledby="sec-floating">
          <div className="mb-3">
            <h2 id="sec-floating" className="text-[16px] font-bold">
              ফ্লোটিং প্লেয়ার ও হোম উইগেট
            </h2>
            <p className="mt-0.5 text-xs text-mute">ব্যাকগ্রাউন্ড ভিডিও/মিউজিক ও ড্যাশবোর্ড উইগেট নিয়ন্ত্রণ করুন</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              role="switch"
              aria-checked={bgPlay}
              onClick={() => {
                const next = !bgPlay;
                setBgPlay(next);
                toast(next ? "ফ্লোটিং ও ব্যাকগ্রাউন্ড প্লে চালু হয়েছে" : "ব্যাকগ্রাউন্ড প্লে বন্ধ হয়েছে");
              }}
              className={cn(
                "flex min-h-[68px] items-center justify-between gap-3 rounded-2xl p-4 text-left transition active:scale-[0.98]",
                bgPlay ? "glow-ring bg-surface" : "card-edge bg-surface hover:bg-surface2"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", bgPlay ? "bg-neon text-ink" : "bg-surface2 text-mute")}>
                  <PictureInPicture2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">ফ্লোটিং ও ব্যাকগ্রাউন্ড প্লে</p>
                  <p className="text-[11px] text-mute leading-snug">ইউটিউব, মুভি, মিউজিক ও স্পোর্টস মিনি-প্লেয়ারে চলবে</p>
                </div>
              </div>
              <span
                className={cn(
                  "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  bgPlay ? "bg-neon justify-end" : "bg-surface2 justify-start border border-line"
                )}
              >
                <span className={cn("h-5 w-5 rounded-full transition-transform", bgPlay ? "bg-ink" : "bg-mute")} />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={showWidgets}
              onClick={() => {
                const next = !showWidgets;
                setShowWidgets(next);
                toast(next ? "হোম ও ওয়েদার উইগেট চালু হয়েছে" : "হোম উইগেট লুকানো হয়েছে");
              }}
              className={cn(
                "flex min-h-[68px] items-center justify-between gap-3 rounded-2xl p-4 text-left transition active:scale-[0.98]",
                showWidgets ? "glow-ring bg-surface" : "card-edge bg-surface hover:bg-surface2"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", showWidgets ? "bg-neon text-ink" : "bg-surface2 text-mute")}>
                  <LayoutGrid className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">অ্যাপ ও ওয়েদার উইগেট</p>
                  <p className="text-[11px] text-mute leading-snug">হোম পেজে নিজস্ব অ্যাপ ও আলাদা ওয়েদার উইগেট</p>
                </div>
              </div>
              <span
                className={cn(
                  "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  showWidgets ? "bg-neon justify-end" : "bg-surface2 justify-start border border-line"
                )}
              >
                <span className={cn("h-5 w-5 rounded-full transition-transform", showWidgets ? "bg-ink" : "bg-mute")} />
              </span>
            </button>
          </div>
        </section>

        <div className="border-t border-line" />

        {/* Storage & Cache Section */}
        <section aria-labelledby="sec-storage">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="sec-storage" className="text-[16px] font-bold">
                স্টোরেজ ও ক্যাশ ব্যবস্থাপনা
              </h2>
              <p className="mt-0.5 text-xs text-mute tabular-nums">
                পছন্দের গান: {liked.length} টি · প্রিয় টিভি চ্যানেল: {favCh.length} টি
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleClearCache}
              className="card-edge flex min-h-[56px] items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left transition hover:bg-surface2 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-neon">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">অ্যাপ ক্যাশ পরিষ্কার করুন</p>
                  <p className="text-[11px] text-mute">নতুন লাইভ ম্যাচ ও ক্যাটালগ রিফ্রেশ করতে সহায়ক</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleResetSaved}
              onBlur={() => setConfirmClear(false)}
              className={cn(
                "card-edge flex min-h-[56px] items-center justify-between rounded-2xl px-4 py-3 text-left transition active:scale-[0.98]",
                confirmClear ? "bg-live/15 ring-1 ring-live" : "bg-surface hover:bg-surface2"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-live/15 text-live">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{confirmClear ? "নিশ্চিত করতে আবার ট্যাপ করুন" : "সংরক্ষিত পছন্দ রিসেট করুন"}</p>
                  <p className="text-[11px] text-mute">পছন্দের গান, প্রিয় চ্যানেল ও সাম্প্রতিক সার্চ মুছবে</p>
                </div>
              </div>
            </button>
          </div>
        </section>

        <div className="border-t border-line" />

        {/* Security & App Info */}
        <section aria-labelledby="sec-about" className="panel rounded-2xl p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-neon/15 text-neon">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 id="sec-about" className="text-[15px] font-bold">
                  ৪x লেয়ার সিকিউরিটি ও অ্যাপ প্রোটেকশন
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-mute">
                  ৪-স্তরের ক্রিপ্টোগ্রাফিক এন্ডপয়েন্ট ভল্ট, সার্ভার-সাইড রেট-লিমিটেড গেটওয়ে, MITM সার্টিফিকেট ব্লকিং এবং অ্যান্ড্রয়েড R8 ফুল অবফাস্কেশন সক্রিয়
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-mute sm:text-right">
              <Smartphone className="h-4 w-4 text-neon shrink-0" />
              <span className="whitespace-nowrap font-semibold">Mukul Plus · v2.0</span>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
