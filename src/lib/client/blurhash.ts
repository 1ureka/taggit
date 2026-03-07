import { blurhashToDataUri } from "@unpic/placeholder";

/**
 * 出廠預設 BlurHash — 中性灰調，用於 staged/trash 等沒有個別 BlurHash 的圖片。
 * 可在 Settings「圖片與快取」章節中自訂替換。
 */
export const FALLBACK_BLURHASH = "L7D07P00-o~q~pof00WB00NHM|4n";

/**
 * 將 blurhash 轉為可直接套用在 <img> 上的 CSS style 字串。
 * fit 參數應與該 <img> 的 object-fit 一致（預設 "cover"）。
 * 若 blurhash 為空，回傳 undefined（不套用樣式）。
 */
export function blurhashStyle(blurhash: string, fit: "cover" | "contain" = "cover"): string | undefined {
  if (!blurhash) return undefined;
  const uri = blurhashToDataUri(blurhash);
  return [
    `background-image:url(${uri})`,
    `background-size:${fit}`,
    "background-repeat:no-repeat",
    "background-position:center",
  ].join(";");
}
