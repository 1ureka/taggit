import { getSettingsContext } from "./context.svelte.js";

/** 導航區塊定義 */
type NavSection = {
  id: string;
  label: string;
};

/**
 * 建立設定頁面導航邏輯的核心工廠函數
 */
export function createSettingsNav() {
  /** Settings 頁面共享的 Context */
  const ctx = getSettingsContext();

  /** 目前活動的區塊 ID */
  let activeId = $state("collection");

  /** 導航區塊列表（依據圖片集是否已設定動態產生） */
  const sections = $derived.by(() => {
    const base: NavSection[] = [{ id: "collection", label: "圖片集路徑" }];
    if (ctx.collectionRoot) {
      base.push({ id: "tags", label: "標籤管理" });
      base.push({ id: "images", label: "圖片與快取" });
      base.push({ id: "maintenance", label: "系統維護" });
    }
    return base;
  });

  // ---

  /** 根據滾動位置更新活動區塊（由 scroll 事件觸發） */
  $effect(() => {
    const ids = sections.map((s) => s.id);
    const container = document.getElementById("settings-main");
    if (!container) return;

    function onScroll() {
      const containerTop = container!.getBoundingClientRect().top;
      let current = ids[0] ?? "collection";
      for (const id of ids) {
        const el = document.getElementById(`section-${id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - containerTop <= 100) {
          current = id;
        }
      }
      activeId = current;
    }

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  });

  // ---

  /** 處理導航項目點擊事件，滾動至對應區塊 */
  function handleNavClick(id: string) {
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  // ---

  return {
    /** 存取導航區塊列表的 getter */
    get sections() {
      return sections;
    },
    /** 存取目前活動區塊 ID 的 getter */
    get activeId() {
      return activeId;
    },
    /** 處理導航項目點擊事件，滾動至對應區塊 */
    handleNavClick,
  };
}
