/**
 * @file page-data.ts
 * 把 `load` 回傳的 `data` 包成 context，讓子孫元件可以直接取用即時值。
 * 收 getter 而不是 `data` 本身，因為 `data` 會隨 `load` 重新執行而變動，要傳的是「即時讀取」。
 */

import type { PageData } from "../$types";
import { getContext, setContext } from "svelte";

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
