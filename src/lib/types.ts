/**
 * @module types
 * @description 定義整個專案中使用的型別
 */

import type { HTMLAttributes } from "svelte/elements";

/**
 * 帶有寬高屬性的基本物件介面
 */
export type ItemWithSize = { id: string; width: number; height: number };

/**
 * 將型別展開成較易閱讀的形式
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

// 取 union 中所有成員的所有鍵（非交集）
type UnionKeys<T> = T extends T ? keyof T : never;

type StrictUnionHelper<T, TAll> = T extends any ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>> : never;

/**
 * 給定一組型別陣列，回傳一個聯合型別，自動將任一型別中未出現的屬性設為 never
 */
export type OneOf<T extends any[]> = StrictUnionHelper<T[number], T[number]>;

// ---

/**
 * 一個圖示組件的 props
 */
export interface IconProps extends HTMLAttributes<SVGElement> {
  /** 圖示大小 (CSS 單位) */
  size?: number | string;
  /** 圖示顏色 (CSS 顏色值) */
  color?: string;
}
