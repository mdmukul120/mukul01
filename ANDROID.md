# Mukul Plus – Android অ্যাপ (অটো বিল্ড ও রিলিজ)

`main` ব্রাঞ্চে push করলেই GitHub Actions (`.github/workflows/android.yml`) নিজে থেকে
APK বানিয়ে **Releases** পেজে `v1.0.<রান নম্বর>` ট্যাগে আপলোড করে দেয়।

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

## ব্যবহার
`git push` → Actions ট্যাবে বিল্ড দেখুন (~৫–৮ মিনিট) → **Releases** থেকে APK ডাউনলোড।
হাতে চালাতে: Actions → *Android APK & Release* → **Run workflow**।

## অ্যাপের নাম/আইকন বদলাতে
- নাম/প্যাকেজ: `capacitor.config.ts` (`appName`, `appId`)
- আইকন/স্প্ল্যাশ: `assets/` ফোল্ডারের ছবি বদলান (নাম ঠিক রাখুন)
