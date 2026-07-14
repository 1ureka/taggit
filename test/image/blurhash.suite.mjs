/**
 * @file blurhash.suite.mjs
 * blurhashStyle：純字串輸入輸出。cover 走 data-uri；contain + 寬高走 SVG wrapper；
 * 缺寬高時 contain 退回一般 data-uri 路徑。
 */

export const name = "blurhash (blurhashStyle)";

export async function run(t, h) {
  const { blurhashStyle } = h.modules;

  // ── 預設（cover、無寬高，使用內建 fallback blurhash）──
  {
    const style = blurhashStyle();
    t.ok("含 background-image", style.includes("background-image:url("));
    t.ok("背景圖為 data-uri", style.includes("url(data:image"));
    t.ok("cover 的 background-size 為 cover", style.includes("background-size:cover"));
    t.ok("no-repeat", style.includes("background-repeat:no-repeat"));
    t.ok("置中", style.includes("background-position:center"));
  }

  // ── 明確傳入 cover 與寬高：仍走一般 data-uri（非 SVG）路徑 ──
  {
    const style = blurhashStyle({ fit: "cover", width: 233, height: 144 });
    t.ok("cover + 寬高 background-size 為 cover", style.includes("background-size:cover"));
    t.ok("cover 不使用 SVG wrapper", style.includes("svg+xml") === false);
  }

  // ── contain + 寬高：走 SVG wrapper 以精確保留 aspect ratio ──
  {
    const style = blurhashStyle({ fit: "contain", width: 233, height: 144 });
    t.ok("contain 的 background-size 為 contain", style.includes("background-size:contain"));
    t.ok("contain + 寬高使用 SVG wrapper", style.includes("data:image/svg+xml"));
    t.ok("SVG 內嵌 image 標籤", decodeURIComponent(style).includes("<image"));
    t.ok("SVG viewBox 帶入實際寬高", decodeURIComponent(style).includes("viewBox=\"0 0 233 144\""));
  }

  // ── contain 但缺寬高：退回一般 data-uri 路徑（不生 SVG）──
  {
    const style = blurhashStyle({ fit: "contain" });
    t.ok("contain 缺寬高時退回 contain 一般路徑", style.includes("background-size:contain"));
    t.ok("contain 缺寬高不生 SVG", style.includes("svg+xml") === false);
  }

  // ── 極端長寬比：極寬（width ≫ height）與極高（height ≫ width）都不丟例外且格式正確 ──
  {
    t.notThrows("極寬長寬比 contain 不丟例外", () => blurhashStyle({ fit: "contain", width: 2000, height: 50 }));
    t.notThrows("極高長寬比 contain 不丟例外", () => blurhashStyle({ fit: "contain", width: 50, height: 2000 }));
    const wide = blurhashStyle({ fit: "contain", width: 2000, height: 50 });
    t.ok("極寬比例的 SVG viewBox 帶入原始寬高", decodeURIComponent(wide).includes("viewBox=\"0 0 2000 50\""));
  }

  // ── 寬高為 0 視為未提供，退回一般路徑 ──
  {
    const style = blurhashStyle({ fit: "contain", width: 0, height: 0 });
    t.ok("寬高為 0 時 contain 不生 SVG", style.includes("svg+xml") === false);
  }
}

export default { name, run };
