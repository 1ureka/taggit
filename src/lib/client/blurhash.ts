/**
 * @file blurhash.ts
 * 將 BlurHash 轉為可套用在 `<img>` 上的 CSS 背景樣式字串，用於載入佔位圖。
 */

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
 * 生成包含 BlurHash 圖像的 SVG，並返回其 Data URI。
 */
function generateSvg(width: number, height: number, blurhashDataUri: string): string {
  const svgContent = `
     <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <image
            href="${blurhashDataUri}"
            x="0"
            y="0"
            width="${width}"
            height="${height}"
            preserveAspectRatio="none"
          />
     </svg>
    `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
}

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

  if (fit !== "contain" || !width || !height) {
    const uri = blurhashToDataUri(blurhash, bmpW, bmpH);
    return [
      `background-image:url(${uri})`,
      `background-size:${fit}`,
      "background-repeat:no-repeat",
      "background-position:center",
    ].join(";");
  }

  // 首先注意到，bmpW 和 bmpH 通常小於 64px，但當圖片呈現時，畫面在怎麼小，也應該大於 256px，這意味者
  // Math.round 的 aspect ratio 誤差 **一定** 會被放大到肉眼可見的程度，從而導致 contain 的計算不準確
  // 好一點的情況只是模糊背景比實際圖片小得感受，但壞一點會導致圖片載入完成後，邊緣仍存在模糊背景

  // 當指定了寬高且 fit 為 "contain" 時，為了確保 aspect ratio 與原圖完全一致
  // 改用 SVG 包裹一層，使用 preserveAspectRatio="none" 強制拉伸到指定尺寸，並將 SVG 的背景設為 BlurHash 圖像。
  // 這使得最終 blurhash 的背景圖片的尺寸完全與實際圖片一致，從而使得 contain 的計算完全一致
  const uri = blurhashToDataUri(blurhash, bmpW, bmpH);
  const svgDataUri = generateSvg(width, height, uri);
  return [
    `background-image:url(${svgDataUri})`,
    "background-size:contain",
    "background-repeat:no-repeat",
    "background-position:center",
  ].join(";");
}
