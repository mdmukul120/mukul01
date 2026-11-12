# Mukul Plus – Android অ্যাপ (নেটিভ প্রজেক্ট + অটো বিল্ড ও রিলিজ)

এই রিপোতে এখন আসল অ্যান্ড্রয়েড প্রজেক্ট **`android/`** ফোল্ডারে কমিট করা আছে
(Package: `com.mukul.plus`, App name: `Mukul Plus`, Capacitor 7, minSdk 23, targetSdk 35).
ওয়েব অ্যাপ **একদম অপরিবর্তিত** — অ্যাপটি WebView-তে ওয়েব অ্যাপটাই দেখায়।

`main` ব্রাঞ্চে push করলেই GitHub Actions (`.github/workflows/android.yml`)
APK বানিয়ে **Releases** পেজে `v2.0.<রান নম্বর>` ট্যাগে আপলোড করে দেয়।

## একবারের সেটআপ

1. **ওয়েবসাইট Vercel-এ ডিপ্লয় করুন** (এই প্রজেক্টের `/api` ফাংশন সাইটের সাথেই চলে)।
2. GitHub রিপোতে **Settings → Secrets and variables → Actions → Variables** এ নতুন Variable:
   - `APP_URL` = `https://আপনার-সাইট.vercel.app`
   অ্যাপ এই লিংক WebView-তে খোলে, তাই সাইট আপডেট করলে অ্যাপও নিজে আপডেট হয়।
   (না দিলে সাইটের বিল্ড অ্যাপের ভেতরেই থাকে, কিন্তু তখন `/api` কাজ করবে না।)
3. **সাইন-করা APK (রিকমেন্ডেড)** – একবার কিস্টোর বানান:
   ```bash
   keytool -genkeypair -v -keystore release.jks -alias mukul -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 release.jks     # macOS: base64 -i release.jks
   ```
   তারপর **Secrets**-এ যোগ করুন: `KEYSTORE_BASE64` (উপরের আউটপুট), `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`mukul`), `KEY_PASSWORD`।
   ⚠️ `release.jks` ফাইলটা নিরাপদে রাখুন – হারালে পুরনো অ্যাপের ওপর আপডেট দেওয়া যাবে না।
   Secrets না দিলে ডিবাগ-সাইন করা APK তৈরি হবে (ইনস্টল করা যায়, কিন্তু সাইন কী প্রতিবার আলাদা হতে পারে)।

## লোকালি APK বানাতে (Android Studio বা CLI)

প্রয়োজনীয়তা: JDK 21, Android SDK (Platform 35) — Android Studio থাকলেই সুবিধাজনক।

```bash
npm install --legacy-peer-deps
npm run cap:sync          # ওয়েব বিল্ড + android/-এ কপি

# হয় এটা চালান:
npm run android:debug     # android/app/build/outputs/apk/debug/app-debug.apk
npm run android:release   # সাইন-করা রিলিজ APK (কিস্টোর থাকলে)

# অথবা Android Studio-তে /home/user/mukul01/android ফোল্ডারটি খুলুন → Run ▶
```

**লোকাল রিলিজ সাইন করতে:** `android/keystore.properties` ফাইল (এটি .gitignore-এ, কমিট হবে না):

```properties
storeFile=/absolute/path/to/release.jks
storePassword=xxxx
keyAlias=mukul
keyPassword=xxxx
```

অথবা env var: `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`।
versionName/versionCode বদলাতে: `android/app/build.gradle` (ডিফল্ট `2.0.0` / `200`),
অথবা `-PversionName=x.y.z -PversionCode=N` / env `VERSION_NAME`, `VERSION_CODE` দিন।

## CI কীভাবে কাজ করে
1. `npm run build` → `npx cap sync android` (committed `android/` প্রজেক্টে ওয়েব কপি করে)
2. `KEYSTORE_BASE64` secret থাকলে → `./gradlew assembleRelease` → gradle-ই সাইন করে APK দেয়
3. না থাকলে → `./gradlew assembleDebug` (ডিবাগ-সাইন APK)
4. APK → artifact + **Releases** ট্যাগ `v2.0.<run_number>`

হাত দিয়ে চালাতে: Actions → *Android APK & Release* → **Run workflow**।

## অ্যাপের নাম/আইকন বদলালেই
- নাম/প্যাকেজ/ভার্সন: `capacitor.config.ts` (`appName`, `appId`) + `android/app/src/main/res/values/strings.xml`
- আইকন/স্প্ল্যাশ: `assets/` ফোল্ডারের ছবি বদলান, তারপর
  `npx @capacitor/assets generate --android --assetPath assets --iconBackgroundColor '#2ee83f' --splashBackgroundColor '#040a06'`

## নোট
- `android/app/src/main/assets/public/` (কপি-হওয়া ওয়েব বিল্ড) ও `capacitor.config.json` কমিট করা হয় না — `cap sync` এগুলো নিজে বানিয়ে নেয়।
- `local.properties`, `*.jks`, `keystore.properties` কখনো কমিট হবে না।
