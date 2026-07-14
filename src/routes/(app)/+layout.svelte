<script lang="ts">
  import "$lib/assets/app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types";

  import { IconCompassFilled, IconChevronDown, IconListDetails, IconSettings } from "$lib/icons";
  import { IconArrowLeft, IconArrowRight, IconPhotoFilled, IconTagFilled, IconEditFilled } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { showToasts } from "$lib/components/floating/toast-events";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Tooltip from "$lib/components/floating/Tooltip.svelte";
  import ToastStage from "$lib/components/floating/ToastStage.svelte";
  import ToastList from "$lib/components/floating/ToastList.svelte";
  import NavigationIndicator from "$lib/components/navigation/NavigationIndicator.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import ConfirmDialog from "$lib/widgets/ConfirmDialog.svelte";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  /** 導航面板的項目 */
  const navItems: {
    href: string;
    Icon: typeof IconPhotoFilled;
    name: string;
    desc: string;
    key?: "committed" | "staged";
  }[] = [
    {
      href: "/",
      Icon: IconPhotoFilled,
      name: "瀏覽圖片",
      desc: "以瀑布流、播放器、隨機抽選等多種方式探索已提交的圖片",
    },
    {
      href: "/tagger",
      Icon: IconTagFilled,
      name: "新增圖片",
      desc: "審查並提交暫存的圖片",
      key: "staged",
    },
    {
      href: "/editor",
      Icon: IconEditFilled,
      name: "管理圖片",
      desc: "編輯已提交圖片的名稱、標籤或評分",
      key: "committed",
    },
    {
      href: "/settings",
      Icon: IconSettings,
      name: "設定",
      desc: "調整應用的行為、修復圖片資料或是製作備份",
    },
  ];

  /** 導航項目右側徽章的數字，key 未對應到資料時回傳 undefined（不顯示） */
  const navItemCount = (key: "committed" | "staged" | undefined) => {
    if (key === "committed") return data.committedCount;
    if (key === "staged") return data.stagedCount;
    return undefined;
  };

  // ---

  /** 判斷當前狀態列要顯示的描述 */
  const currentStatus = $derived.by(() => {
    if (page.error) return page.error?.message ?? "發生未知錯誤";

    // TODO: 放寬為 string：/tagger、/editor 等路由要到 Phase 3~6 才存在，typed pathname 會拒絕比較
    const path: string = page.url.pathname;

    if (path === "/") return "正在 探索圖片";
    if (path === "/compare") return "正在 比較圖片";
    if (path === "/tagger") return "正在 審查圖片";
    if (path.startsWith("/tags")) return "正在 整理標籤";
    if (path === "/settings") return "正在 調整設定";

    if (path === "/editor") {
      const searchParams = page.url.searchParams;
      if (searchParams.has("currentId")) {
        return `正在 編輯 ${searchParams.get("currentId")}`;
      } else {
        return "正在 編輯已提交圖片";
      }
    }

    return path;
  });

  /** 判斷當前活躍的導航項目 */
  const currentActiveItem = $derived.by(() => {
    // TODO: 放寬為 string：/tagger、/editor 等路由要到 Phase 3~6 才存在，typed pathname 會拒絕比較
    const path: string = page.url.pathname;

    if (path === "/" || path === "/compare" || path === "/player") return "/";
    if (path === "/tagger") return "/tagger";
    if (path === "/editor" || path.startsWith("/tags")) return "/editor";
    if (path === "/settings") return "/settings";

    return null;
  });

  /** 該頁面是否是全螢幕模式（隱藏 header） */
  const fullscreen = $derived(page.url.pathname.includes("player"));

  // ---

  let navOpen = $state(false);

  const handleToggleNav = () => {
    navOpen = !navOpen;
  };

  const handleNavigateForward = () => {
    history.forward();
    navOpen = false;
  };

  const handleNavigateBack = () => {
    history.back();
    navOpen = false;
  };

  // TODO: 之後做真正的主題選擇 UI，目前先暫時做 light/dark 切換
  const handleToggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
  {#if !fullscreen}
    <header>
      <h1>
        <img src={favicon} alt="" width="24" height="24" />
        Taggit
      </h1>

      <div>
        {#if !navOpen}
          <button
            type="button"
            class="status"
            onclick={handleToggleNav}
            transition:fly={{ duration: 200, y: 35, easing: cubicOut }}
          >
            <IconCompassFilled size={20} />
            <span class="ellipsis">{currentStatus}</span>
            <IconChevronDown size={20} color="var(--color-text-muted)" />
          </button>
        {/if}
      </div>

      <div class="tools">
        <Button variant="ghost" padding="icon" onclick={showToasts} {@attach tooltip({ content: "通知歷史" })}>
          <IconListDetails size={20} />
          <span class="sr-only">通知歷史</span>
        </Button>

        <Button variant="ghost" padding="icon" onclick={handleToggleTheme} {@attach tooltip({ content: "切換主題" })}>
          <span class="theme-preview"></span>
          <span class="sr-only">切換主題</span>
        </Button>
      </div>
    </header>
  {/if}

  {@render children()}
</div>

<Modal open={navOpen} onclose={handleToggleNav} aria-label="導航面板">
  <div class="panel">
    <header>
      <Button variant="ghost" padding="icon" onclick={handleNavigateBack} aria-label="上一頁">
        <IconArrowLeft size={16} />
      </Button>
      <span class="ellipsis">
        {data.collectionName + page.url.pathname + page.url.search}
      </span>
      <Button variant="ghost" padding="icon" onclick={handleNavigateForward} aria-label="下一頁">
        <IconArrowRight size={16} />
      </Button>
    </header>

    <nav>
      {#each navItems as { href, Icon, name, desc, key } (href)}
        <a class:active={href === currentActiveItem} {href} onclick={handleToggleNav}>
          <span class="icon"><Icon size={18} /></span>
          <h2>{name}</h2>
          {#if navItemCount(key) !== undefined}
            <span class="badge"><Chip>{navItemCount(key)}</Chip></span>
          {/if}
          <p>{desc}</p>
        </a>
      {/each}
    </nav>
  </div>
</Modal>

<ConfirmDialog />
<Tooltip />
<ToastStage />
<ToastList />
<NavigationIndicator />

<style>
  .shell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: 100dvh;
    overflow: hidden;
  }

  /* --- */

  .shell > header {
    display: grid;
    grid-template-columns: 1fr minmax(200px, 260px) 1fr;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    height: 3rem;
    min-height: 3rem;
    background-color: var(--color-bg-card);
    border-bottom: var(--border-style);

    & > h1 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font: var(--font-title2);
      font-weight: normal;
      letter-spacing: 0.1rem;
    }

    & > div:has(.status) {
      display: flex;
      justify-content: center;
    }

    & > div > .status {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 1rem;
      align-items: center;
      text-align: left;
      padding: 0.25rem 0.5rem;
      font: var(--font-input);
      color: var(--color-text);
      background-color: var(--color-bg);
      border: var(--border-style);
      border-radius: var(--border-radius);
      transition:
        scale 0.15s,
        box-shadow 0.15s;

      &:hover {
        box-shadow: 0 0 0 0.25rem var(--color-bg-active);
      }

      &:active {
        scale: 0.97;
      }
    }

    & > .tools {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
    }
  }

  .theme-preview {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    border: var(--border-style);
    border-color: var(--color-text);
    background-color: var(--color-bg-hover);
  }

  /* --- */

  .panel {
    display: flex;
    flex-direction: column;
    width: 32rem;
    max-width: 100%;
    padding: 0.5rem;
  }

  .panel > header {
    height: 2.5rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
    border-bottom: var(--border-style);
    margin-bottom: 0.5rem;

    & > span {
      font: var(--font-kbd);
      color: var(--color-text-muted);
      text-align: center;
    }
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  nav > a {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto;
    row-gap: 0.25rem;
    column-gap: 0.75rem;
    align-items: start;
    padding: 0.5rem 0.75rem;
    border-radius: var(--border-radius);
    background-color: transparent;
    text-decoration: none;

    &:hover {
      background-color: var(--color-bg-hover);
    }

    &.active {
      background-color: var(--color-bg-hover);

      &:hover {
        background-color: var(--color-bg-active);
      }
    }

    &.active::after {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background-color: var(--color-accent);
      border-radius: 999px;
    }

    & > .icon {
      grid-column: 1;
      grid-row: 1 / 3;
      display: grid;
      place-items: center;
      padding-top: 0.15rem;
    }

    & > h2 {
      grid-column: 2;
      color: var(--color-text);
      font: var(--font-title2);
      text-align: left;
    }

    & > .badge {
      grid-column: 3;
      grid-row: 1;
      align-self: center;
      justify-self: end;
    }

    & > p {
      grid-column: 2;
      color: var(--color-text-muted);
      font: var(--font-body2);
      text-align: left;
    }
  }
</style>
