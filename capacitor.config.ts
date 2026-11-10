import type { CapacitorConfig } from "@capacitor/cli";

// APP_URL = your deployed site (e.g. https://mukul-plus.vercel.app).
// The app loads it inside a WebView so the /api/* functions (youtube, stream, proxy) keep working
// and every Vercel deploy updates the app instantly. If APP_URL is empty the bundled build (dist) is used.
const url = (process.env.APP_URL || "").trim();

const config: CapacitorConfig = {
  appId: "com.mukul.plus",
  appName: "Mukul Plus",
  webDir: "dist",
  backgroundColor: "#040a06",
  android: { allowMixedContent: true },
  server: {
    androidScheme: "https",
    ...(url ? { url, cleartext: false } : {}),
    allowNavigation: ["*"],
  },
};

export default config;
