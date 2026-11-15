import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function endpointVaultPlugin(): Plugin {
  const virtualId = "virtual:api-vault";
  const resolvedId = "\0" + virtualId;

  return {
    name: "endpoint-vault-plugin",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const raw = fs.readFileSync(path.resolve(__dirname, "vault.endpoints.json"), "utf8");
      const plain = Buffer.from(raw, "utf8");

      // Layer 1: Reverse byte order & salt pad
      const rev = Buffer.alloc(plain.length);
      for (let i = 0; i < plain.length; i++) {
        rev[i] = plain[plain.length - 1 - i];
      }

      // Layer 2: Random 64-byte RC4 KSA + PRGA stream cipher
      const key = crypto.randomBytes(64);
      const s = new Uint8Array(256);
      for (let i = 0; i < 256; i++) s[i] = i;
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key[i % 64]) & 0xff;
        const tmp = s[i];
        s[i] = s[j];
        s[j] = tmp;
      }

      const stage2 = new Uint8Array(rev.length);
      let a = 0;
      let b = 0;
      for (let i = 0; i < rev.length; i++) {
        a = (a + 1) & 0xff;
        b = (b + s[a]) & 0xff;
        const tmp = s[a];
        s[a] = s[b];
        s[b] = tmp;
        const ks = s[(s[a] + s[b]) & 0xff];
        stage2[i] = rev[i] ^ ks;
      }

      // Layer 3: Nibble rotation + rolling index mask
      const salt = crypto.randomBytes(16);
      const stage3 = new Array<number>(stage2.length);
      for (let i = 0; i < stage2.length; i++) {
        const nib = ((stage2[i] << 4) | (stage2[i] >> 4)) & 0xff;
        stage3[i] = nib ^ salt[(i * 5 + 3) % 16] ^ ((i * 73 + 17) & 0xff);
      }

      // Layer 4: Split keys into shuffled fragments
      const ka = Array.from(key.subarray(0, 16));
      const kb = Array.from(key.subarray(16, 32));
      const kc = Array.from(key.subarray(32, 48));
      const kd = Array.from(key.subarray(48, 64));
      const sa = Array.from(salt.subarray(0, 8));
      const sb = Array.from(salt.subarray(8, 16));

      return `
let _v = null;
const _x1 = ${JSON.stringify(ka)};
const _x2 = ${JSON.stringify(kb)};
const _x3 = ${JSON.stringify(kc)};
const _x4 = ${JSON.stringify(kd)};
const _s1 = ${JSON.stringify(sa)};
const _s2 = ${JSON.stringify(sb)};
const _d0 = ${JSON.stringify(stage3)};
export function getVault() {
  if (_v) return _v;
  const k = [..._x1, ..._x2, ..._x3, ..._x4];
  const st = [..._s1, ..._s2];
  const n = _d0.length;
  const u2 = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const u = _d0[i] ^ st[(i * 5 + 3) % 16] ^ ((i * 73 + 17) & 0xff);
    u2[i] = ((u >> 4) | (u << 4)) & 0xff;
  }
  const sbox = new Uint8Array(256);
  for (let i = 0; i < 256; i++) sbox[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + sbox[i] + k[i % 64]) & 0xff;
    const t = sbox[i];
    sbox[i] = sbox[j];
    sbox[j] = t;
  }
  const rev = new Uint8Array(n);
  let p = 0;
  let q = 0;
  for (let i = 0; i < n; i++) {
    p = (p + 1) & 0xff;
    q = (q + sbox[p]) & 0xff;
    const t = sbox[p];
    sbox[p] = sbox[q];
    sbox[q] = t;
    rev[i] = u2[i] ^ sbox[(sbox[p] + sbox[q]) & 0xff];
  }
  const plain = new Uint8Array(n);
  for (let i = 0; i < n; i++) plain[i] = rev[n - 1 - i];
  _v = JSON.parse(new TextDecoder().decode(plain));
  return _v;
}
`;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), endpointVaultPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  esbuild: mode === "production" ? { drop: ["console", "debugger"] } : undefined,
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
}));
