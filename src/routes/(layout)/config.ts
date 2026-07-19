import { IconSettings, IconPhotoFilled, IconTagFilled, IconEditFilled } from "$lib/icons";

/** 導航面板的項目 */
export const navItems: {
  href: string;
  Icon: typeof IconPhotoFilled;
  name: string;
  desc: string;
  key?: "committed" | "staged";
}[] = [
  {
    href: "/",
    Icon: IconPhotoFilled,
    name: "瀏覽圖片",
    desc: "以瀑布流、播放器、隨機抽選等多種方式探索已提交的圖片",
  },
  {
    href: "/staged",
    Icon: IconTagFilled,
    name: "新增圖片",
    desc: "審查並提交暫存的圖片",
    key: "staged",
  },
  {
    href: "/committed",
    Icon: IconEditFilled,
    name: "管理圖片",
    desc: "編輯已提交圖片的名稱、標籤或評分",
    key: "committed",
  },
  {
    href: "/settings",
    Icon: IconSettings,
    name: "設定",
    desc: "調整應用的行為、修復圖片資料或是製作備份",
  },
];
