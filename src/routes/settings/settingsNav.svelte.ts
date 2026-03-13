/**
 * 導航區塊定義
 */
type NavSection = {
  id: string;
  label: string;
};

/**
 * SettingsNav 的配置選項
 */
type SettingsNavOptions = {
  /** 唯讀：圖片集根目錄（判斷是否顯示完整導航） */
  collectionRoot: string;
};

/**
 * SettingsNav 的互動邏輯
 */
export class SettingsNav {
  /** 目前活動的區塊 ID */
  activeId = $state("collection");

  /** 導航區塊列表 */
  sections: NavSection[];

  constructor(options: SettingsNavOptions) {
    this.sections = $derived.by(() => {
      const base: NavSection[] = [{ id: "collection", label: "圖片集路徑" }];
      if (options.collectionRoot) {
        base.push({ id: "tags", label: "標籤管理" });
        base.push({ id: "images", label: "圖片與快取" });
        base.push({ id: "maintenance", label: "系統維護" });
      }
      return base;
    });

    $effect(() => {
      const ids = this.sections.map((s) => s.id);
      const container = document.getElementById("settings-main");
      if (!container) return;

      const onScroll = () => {
        const containerTop = container.getBoundingClientRect().top;
        let current = ids[0] ?? "collection";
        for (const id of ids) {
          const el = document.getElementById(`section-${id}`);
          if (!el) continue;
          if (el.getBoundingClientRect().top - containerTop <= 100) {
            current = id;
          }
        }
        this.activeId = current;
      };

      container.addEventListener("scroll", onScroll, { passive: true });
      return () => container.removeEventListener("scroll", onScroll);
    });
  }

  // ---

  /** 處理導航項目點擊事件，滾動至對應區塊 */
  handleNavClick = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };
}
