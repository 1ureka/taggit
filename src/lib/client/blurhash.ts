import { blurhashToDataUri } from "@unpic/placeholder";

/**
 * 出廠預設 BlurHash — 中性灰調，用於沒有個別 BlurHash 的圖片。
 */
const FALLBACK_BLURHASH = "L7D07P00-o~q~pof00WB00NHM|4n";

/**
 * blurhashStyle 函數的參數型別
 */
type BlurhashStyleOptions = {
  fit?: "cover" | "contain";
  blurhash?: string;
  width?: number;
  height?: number;
};

/**
 * 將 blurhash 轉為可直接套用在 <img> 上的 CSS style 字串。
 * fit 參數應與該 <img> 的 object-fit 一致（預設 "cover"）。
 * 若 blurhash 為空，回傳預設 BlurHash 的樣式。
 */
export function blurhashStyle(options: BlurhashStyleOptions = {}): string {
  const { fit = "cover", blurhash = FALLBACK_BLURHASH, width, height } = options;

  const BASE = 16;
  let bmpW = BASE;
  let bmpH = BASE;
  if (width && height && width > 0 && height > 0) {
    if (width >= height) {
      bmpW = Math.round((BASE * width) / height);
    } else {
      bmpH = Math.round((BASE * height) / width);
    }
  }

  const uri = blurhashToDataUri(blurhash, bmpW, bmpH);

  return [
    `background-image:url(${uri})`,
    `background-size:${fit}`,
    "background-repeat:no-repeat",
    "background-position:center",
  ].join(";");
}
