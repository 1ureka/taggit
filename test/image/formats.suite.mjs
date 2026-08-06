/**
 * @file formats.suite.mjs
 * 純函式：IMG_EXTS / isImageFile（含大小寫）、isValidSize、mimeTypeOf。
 * 順帶覆蓋 client.imgSrc 的 URL 組裝。
 */

export const name = "formats (isImageFile / isValidSize / mimeTypeOf) + imgSrc";

export async function run(t, h) {
  const { isImageFile, isValidSize, mimeTypeOf, IMG_EXTS, imgSrc } = h.modules;

  // ── isImageFile：各副檔名（含大小寫）──
  {
    t.ok("jpg 是圖片", isImageFile("a.jpg"));
    t.ok("大寫 JPG 是圖片（副檔名不分大小寫）", isImageFile("A.JPG"));
    t.ok("混合大小寫 .PnG 是圖片", isImageFile("photo.PnG"));
    t.ok("webp 是圖片", isImageFile("x.webp"));
    t.ok("gif 是圖片", isImageFile("x.gif"));
    t.ok("avif 是圖片", isImageFile("x.avif"));
    t.ok("txt 不是圖片", isImageFile("readme.txt") === false);
    t.ok("無副檔名不是圖片", isImageFile("noext") === false);
    t.ok("svg 不在支援清單（IMG_EXTS 不含）", isImageFile("x.svg") === false);
  }

  // ── IMG_EXTS 集合內容 ──
  {
    t.ok("IMG_EXTS 含 .png", IMG_EXTS.has(".png"));
    t.ok("IMG_EXTS 不含 .txt", IMG_EXTS.has(".txt") === false);
  }

  // ── isValidSize ──
  {
    t.ok("sm 合法", isValidSize("sm"));
    t.ok("md 合法", isValidSize("md"));
    t.ok("xl 合法", isValidSize("xl"));
    t.ok("lg 不合法", isValidSize("lg") === false);
    t.ok("空字串不合法", isValidSize("") === false);
    t.ok("undefined 不合法", isValidSize(undefined) === false);
    t.ok("null 不合法", isValidSize(null) === false);
  }

  // ── mimeTypeOf ──
  {
    t.eq("jpg → image/jpeg", mimeTypeOf("a.jpg"), "image/jpeg");
    t.eq("jpeg → image/jpeg", mimeTypeOf("a.jpeg"), "image/jpeg");
    t.eq("png → image/png", mimeTypeOf("a.png"), "image/png");
    t.eq("webp → image/webp", mimeTypeOf("a.webp"), "image/webp");
    t.eq("gif → image/gif", mimeTypeOf("a.gif"), "image/gif");
    t.eq("大寫 PNG 也對應（不分大小寫）", mimeTypeOf("A.PNG"), "image/png");
    t.eq("svg → image/svg+xml", mimeTypeOf("a.svg"), "image/svg+xml");
    t.eq("未知副檔名 → application/octet-stream", mimeTypeOf("a.xyz"), "application/octet-stream");
    t.eq("無副檔名 → application/octet-stream", mimeTypeOf("noext"), "application/octet-stream");
  }

  // ── imgSrc：URL 組裝 + 編碼 ──
  {
    t.eq("無 size 無 animated", imgSrc("a.jpg"), "/api/files/a.jpg");
    t.eq("帶 size", imgSrc("a.jpg", "md"), "/api/files/a.jpg?size=md");
    t.eq("帶 size 與 animated", imgSrc("a.gif", "md", true), "/api/files/a.gif?size=md&animated=1");
    t.eq("animated 為 false 不附旗標", imgSrc("a.gif", "md", false), "/api/files/a.gif?size=md");
    t.eq("非 ASCII 檔名被 URL 編碼", imgSrc("一張圖片.jpg", "md"), "/api/files/%E4%B8%80%E5%BC%B5%E5%9C%96%E7%89%87.jpg?size=md");
  }
}

export default { name, run };
