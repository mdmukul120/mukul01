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

      // Compute FNV-1a 32-bit integrity digest
      let fnv = 0x811c9dc5;
      for (let i = 0; i < plain.length; i++) {
        fnv ^= plain[i];
        fnv = Math.imul(fnv, 0x01000193) >>> 0;
      }

      // Layer 1: Reverse byte order
      const rev = Buffer.alloc(plain.length);
      for (let i = 0; i < plain.length; i++) {
        rev[i] = plain[plain.length - 1 - i];
      }

      // Layer 2: Dynamic 32-byte pre-mask XOR
      const maskA = crypto.randomBytes(32);
      const s2 = new Uint8Array(rev.length);
      for (let i = 0; i < rev.length; i++) {
        s2[i] = rev[i] ^ maskA[(i * 7 + 3) % 32];
      }

      // Layer 3: Bitwise rotate left 3 bits
      const s3 = new Uint8Array(s2.length);
      for (let i = 0; i < s2.length; i++) {
        s3[i] = ((s2[i] << 3) | (s2[i] >> 5)) & 0xff;
      }

      // Layer 4: Random 64-byte RC4 KSA + PRGA stream cipher
      const key = crypto.randomBytes(64);
      const sbox = new Uint8Array(256);
      for (let i = 0; i < 256; i++) sbox[i] = i;
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + sbox[i] + key[i % 64]) & 0xff;
        const tmp = sbox[i];
        sbox[i] = sbox[j];
        sbox[j] = tmp;
      }
      const s4 = new Uint8Array(s3.length);
      let a = 0;
      let b = 0;
      for (let i = 0; i < s3.length; i++) {
        a = (a + 1) & 0xff;
        b = (b + sbox[a]) & 0xff;
        const tmp = sbox[a];
        sbox[a] = sbox[b];
        sbox[b] = tmp;
        s4[i] = s3[i] ^ sbox[(sbox[a] + sbox[b]) & 0xff];
      }

      // Layer 5: Affine byte transform (13x + 71) mod 256 (inverse: (y - 71) * 197 mod 256)
      const s5 = new Uint8Array(s4.length);
      for (let i = 0; i < s4.length; i++) {
        s5[i] = (s4[i] * 13 + 71) & 0xff;
      }

      // Layer 6: CBC chaining XOR across adjacent bytes
      const iv = crypto.randomBytes(1)[0];
      const s6 = new Uint8Array(s5.length);
      let prev = iv;
      for (let i = 0; i < s5.length; i++) {
        s6[i] = s5[i] ^ prev ^ ((i * 29 + 11) & 0xff);
        prev = s6[i];
      }

      // Layer 7: Nibble rotation + rolling 16-byte salt
      const salt = crypto.randomBytes(16);
      const s7 = new Array<number>(s6.length);
      for (let i = 0; i < s6.length; i++) {
        const nib = ((s6[i] << 4) | (s6[i] >> 4)) & 0xff;
        s7[i] = nib ^ salt[(i * 5 + 3) % 16] ^ ((i * 73 + 17) & 0xff);
      }

      // Layer 8-10: Split keys/masks/salts into scattered segments + integrity seal
      const ka = Array.from(key.subarray(0, 16));
      const kb = Array.from(key.subarray(16, 32));
      const kc = Array.from(key.subarray(32, 48));
      const kd = Array.from(key.subarray(48, 64));
      const ma = Array.from(maskA.subarray(0, 16));
      const mb = Array.from(maskA.subarray(16, 32));
      const sa = Array.from(salt.subarray(0, 8));
      const sb = Array.from(salt.subarray(8, 16));

      return `
let _v = null;
const _x1 = ${JSON.stringify(ka)};
const _x2 = ${JSON.stringify(kb)};
const _x3 = ${JSON.stringify(kc)};
const _x4 = ${JSON.stringify(kd)};
const _m1 = ${JSON.stringify(ma)};
const _m2 = ${JSON.stringify(mb)};
const _s1 = ${JSON.stringify(sa)};
const _s2 = ${JSON.stringify(sb)};
const _iv = ${iv};
const _dg = ${fnv};
const _d0 = ${JSON.stringify(s7)};
export function getVault() {
  if (_v) return _v;
  const k = [..._x1, ..._x2, ..._x3, ..._x4];
  const mk = [..._m1, ..._m2];
  const st = [..._s1, ..._s2];
  const n = _d0.length;
  const u6 = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const u = _d0[i] ^ st[(i * 5 + 3) % 16] ^ ((i * 73 + 17) & 0xff);
    u6[i] = ((u >> 4) | (u << 4)) & 0xff;
  }
  const u5 = new Uint8Array(n);
  let prev = _iv;
  for (let i = 0; i < n; i++) {
    u5[i] = u6[i] ^ prev ^ ((i * 29 + 11) & 0xff);
    prev = u6[i];
  }
  const u4 = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u4[i] = (((u5[i] - 71) & 0xff) * 197) & 0xff;
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
  const u3 = new Uint8Array(n);
  let p = 0;
  let q = 0;
  for (let i = 0; i < n; i++) {
    p = (p + 1) & 0xff;
    q = (q + sbox[p]) & 0xff;
    const t = sbox[p];
    sbox[p] = sbox[q];
    sbox[q] = t;
    u3[i] = u4[i] ^ sbox[(sbox[p] + sbox[q]) & 0xff];
  }
  const u2 = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u2[i] = ((u3[i] >> 3) | (u3[i] << 5)) & 0xff;
  }
  const rev = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    rev[i] = u2[i] ^ mk[(i * 7 + 3) % 32];
  }
  const plain = new Uint8Array(n);
  let check = 0x811c9dc5;
  for (let i = 0; i < n; i++) {
    const b = rev[n - 1 - i];
    plain[i] = b;
    check ^= b;
    check = Math.imul(check, 0x01000193) >>> 0;
  }
  if (check !== _dg) throw new Error("Vault integrity check failed");
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
