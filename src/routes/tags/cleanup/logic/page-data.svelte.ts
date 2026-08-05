/**
 * @file page-data.svelte.ts
 * 以 context 包裝 `load` 回傳的 `data`，讓子元件即時讀取最新值
 */

import type { PageData } from "../$types";
import { getContext, setContext } from "svelte";

/** 一則清理建議；型別自 SSR 資料推導 */
export type Suggestion = PageData["suggestions"][number];

const key = Symbol("page-data");

export const createPageDataContext = (getData: () => PageData) => {
  const context = {
    get value() {
      return getData();
    },
  };
  setContext(key, context);
  return context;
};

export const getPageDataContext = () => getContext<{ readonly value: PageData }>(key);
