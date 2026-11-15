import type { CapacitorConfig } from "@capacitor/cli";

// APP_URL = your deployed site (e.g. https://mukul-plus.vercel.app).
// When empty, bundled dist/ runs natively with encrypted endpoint vault + CapacitorHttp.
const url = (process.env.APP_URL || "").trim();

const config: CapacitorConfig = {
  appId: "com.mukul.plus",
  appName: "Mukul Plus",
  webDir: "dist",
  backgroundColor: "#040a06",
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
    ...(url ? { url, cleartext: false } : {}),
    allowNavigation: ["*"],
  },
};

export default config;
