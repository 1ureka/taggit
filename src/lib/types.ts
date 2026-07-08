/**
 * @file 跨領域的 UI 型別。
 *
 * 業務模組的型別已移至各模組入口：
 *   - 查詢／紀錄／標籤型別：`$lib/database/server.ts` 與 `$lib/database/client.ts`
 *   - 圖片尺寸：`$lib/image/server.ts` 與 `$lib/image/client.ts`
 *   - collection 路徑：`$lib/collection/server.ts` 與 `$lib/collection/client.ts`
 */

/**
 * 帶有寬高屬性的基本物件介面
 */
export type ItemWithSize = { id: string; width: number; height: number };

// ---

/**
 * 一個圖示組件的 props
 */
export type IconProps = {
  /** 圖示大小 (CSS 單位) */
  size?: number | string;
  /** 圖示顏色 (CSS 顏色值) */
  color?: string;
};
