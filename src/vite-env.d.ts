/// <reference types="vite/client" />

declare module "virtual:api-vault" {
  export interface ApiVault {
    ott: string;
    ctg: string;
    bongoScrape: string;
    bongoHls1: string;
    bongoHls2: string;
    catalog: string;
    sports1: string;
    sports2: string;
    sports3: string;
    music: string;
    ytV3: string;
    ytInner: string;
    ytKeys: string[];
    wx: string;
    wxKey: string;
    px1: string;
    px2: string;
  }
  export function getVault(): ApiVault;
}
