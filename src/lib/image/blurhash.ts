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

  // 首先注意到，bmpW 和 bmpH 通常小於 64px，但當圖片呈現時，畫面在怎麼小，視口也應該大於 256px，這意味者
  // Math.round 的 aspect ratio 誤差 **一定** 會被放大到肉眼可見的程度，從而導致 contain 的計算不準確 (詳見下方補充)

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

  // 補充:
  // 例如，假設一張圖片的原始尺寸是 233:144，其比例是 1.61805555555555... ，為無理數
  // 但其 BlurHash 會被計算為 26:16 的尺寸，其比例為 1.625
  // 當放到一個高度為 1024px, 寬度 1024px 的 object-fit: contain 的 img 上時
  // 背景的 blurhash 圖像會被放大到 26/16 * 1024 = 1664px 的寬度，而實際圖片則是 1.618... * 1024 = 1,656.888...px 的寬度
  // 這導致了圖片載入完成後，左右兩側仍會有模糊背景的殘留，這是絕對不可接受的
  // 而 SVG 解法在數學上，精確且確定性的解決了該問題
}
