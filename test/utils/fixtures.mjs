/**
 * @file utils/fixtures.mjs
 * utils 領域的 fixtures：載入 lib/utils 底下與 UI 框架無關的純函式模組。
 *
 * 新增一個後端領域（例如 collection / image）時，仿此檔在該領域資料夾放一支
 * fixtures.mjs，用同一個 loader 載入該領域模組並回傳自己的工具即可。
 */

/**
 * @param {{ load: (p: string) => Promise<any> }} loader core/loader.mjs 的產物
 * @returns fixtures 物件 h：{ modules, makeViewport }
 */
export async function createUtilsFixtures(loader) {
  const { load } = loader;

  const virtualizeCore = await load("/src/lib/utils/virtualize.core.ts");

  const modules = {
    ...virtualizeCore, // createVirtualizeLayout, createVirtualizeContent, getItemPixelRect
  };

  /**
   * 造一個滿足 createVirtualizeContent/getItemPixelRect 所需最小介面的假 viewportEl，
   * 不需要真的 DOM（測試跑在 Node，沒有瀏覽器環境）。
   */
  const makeViewport = ({ clientWidth = 300, clientHeight = 200, scrollTop = 0 } = {}) => ({
    clientWidth,
    clientHeight,
    scrollTop,
  });

  return { modules, makeViewport };
}
