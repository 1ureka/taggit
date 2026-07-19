/**
 * @file nav.svelte.ts
 * 側邊導覽清單 + scroll-spy。做法見 docs/scroll.md：
 * activeId 由可覆寫的 $derived(page.url.hash) 決定，點擊導覽連結時 URL hash 直接變動、立即反映；
 * 捲動時由 IntersectionObserver 偵測目前可見的區塊，debounce 後用 replaceState 寫入 page.state.activeHash，
 * 觸發 $effect 暫時覆寫 activeId —— 掛載時 observer 的初始 fire 天然涵蓋「捲動位置被瀏覽器還原」的情況，
 * 不需要額外手動補算一次。
 */

import { getContext, setContext, onDestroy } from "svelte";
import { page } from "$app/state";
import { replaceState } from "$app/navigation";
import { getPageDataContext } from "./page-data.svelte";

const HASH_PREFIX = "#section-";
const DEBOUNCE_MS = 150;

class NavController {
  private pageData = getPageDataContext();
  private observer: IntersectionObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  sections = $derived.by(() => {
    const base = [{ id: "collection", label: "圖片集路徑" }];
    if (this.pageData.value.databaseLoaded) {
      base.push({ id: "images", label: "圖片與快取" }, { id: "maintenance", label: "系統維護" });
    }
    return base;
  });

  /** 目前作用中的 hash；來自 URL，但捲動時會被 IntersectionObserver 的結果暫時覆寫 */
  private currentHash = $derived(page.url.hash);

  /** 目前反白的導覽項目 id；未帶 hash（例如剛載入頁面）時預設第一個區塊 */
  activeId = $derived(
    this.currentHash.startsWith(HASH_PREFIX) ? this.currentHash.slice(HASH_PREFIX.length) : this.sections[0]?.id,
  );

  constructor() {
    $effect(() => {
      const activeHash = (page.state as { activeHash?: string }).activeHash;
      if (activeHash) this.currentHash = activeHash;
    });

    try {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
              replaceState(location.href, { ...page.state, activeHash: `#${entry.target.id}` });
            }, DEBOUNCE_MS);
          }
        },
        { rootMargin: "-100px 0px -70% 0px" },
      );
    } catch {
      this.observer = null;
    }

    onDestroy(() => {
      clearTimeout(this.timer);
      this.observer?.disconnect();
    });
  }

  /** section 元素掛載時透過 {@attach} 呼叫，交給 IntersectionObserver 追蹤 */
  observe = (node: Element) => {
    this.observer?.observe(node);
    return () => this.observer?.unobserve(node);
  };
}

const key = Symbol("nav-controller");

export const createNavContext = () => {
  const controller = new NavController();
  setContext(key, controller);
  return controller;
};

export const getNavContext = () => getContext<NavController>(key);
