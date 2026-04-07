<script lang="ts">
  import "$lib/styles/app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  import { IconCompassFilled, IconChevronDown, IconEditFilled, IconPhotoFilled } from "$lib/icons";
  import { IconArrowLeft, IconArrowRight, IconSettings, IconTagFilled } from "$lib/icons";
  import Modal from "$lib/components/Modal.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { children } = $props();

  /** 導航項目 */
  const navItems = [
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
    },
    {
      href: "/editor",
      Icon: IconEditFilled,
      name: "管理圖片",
      desc: "編輯已提交圖片的名稱、標籤或評分",
    },
    {
      href: "/settings",
      Icon: IconSettings,
      name: "設定",
      desc: "調整應用的行為、修復圖片資料或是製作備份",
    },
  ];

  // ---

  /** 判斷當前狀態列要顯示的描述 */
  const currentStatus = $derived.by(() => {
    if (page.error) return page.error?.message ?? "發生未知錯誤";

    const path = page.url.pathname;

    if (path === "/") return "正在 探索圖片";
    if (path === "/compare") return "正在 比較圖片";
    if (path === "/tagger") return "正在 審查圖片";
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
    const path = page.url.pathname;

    if (path === "/" || path === "/compare" || path === "/player") return "/";
    if (path === "/tagger") return "/tagger";
    if (path === "/editor") return "/editor";
    if (path === "/settings") return "/settings";

    return null;
  });

  /** 該頁面是否是全螢幕模式 */
  const fullscreen = $derived(page.url.pathname.includes("player"));

  // ---

  let open = $state(false);

  const handleTogglePalette = () => {
    open = !open;
  };

  const handleNavigateForward = () => {
    history.forward();
    open = false;
  };

  const handleNavigateBack = () => {
    history.back();
    open = false;
  };
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if !fullscreen}
  <header>
    <h1>
      <img src={favicon} alt="網站圖示" />
      Taggit
    </h1>

    {#if !open}
      <button
        type="button"
        class="text-input"
        onclick={handleTogglePalette}
        transition:fly={{ duration: 200, y: 35, easing: cubicOut }}
      >
        <IconCompassFilled size={20} />
        <span class="ellipsis">{currentStatus}</span>
        <IconChevronDown size={20} color="var(--text-muted)" />
      </button>
    {/if}
  </header>
{/if}

{@render children()}

<Modal {open} onclose={handleTogglePalette} transition="fly" style="padding: 0.5rem;max-width: 32rem;">
  <header>
    <button type="button" class="btn-ghost btn-sm" onclick={handleNavigateBack} aria-label="上一頁">
      <IconArrowLeft size={16} />
    </button>
    <span class="ellipsis">{page.url.pathname + page.url.search}</span>
    <button type="button" class="btn-ghost btn-sm" onclick={handleNavigateForward} aria-label="下一頁">
      <IconArrowRight size={16} />
    </button>
  </header>

  <nav>
    {#each navItems as { href, Icon, name, desc }}
      <a class:active={href === currentActiveItem} {href} onclick={handleTogglePalette}>
        <span><Icon size={18} /></span>
        <h2>{name}</h2>
        {" "}
        <p>{desc}</p>
      </a>
    {/each}
  </nav>
</Modal>

<ConfirmModal />
<Toast />

<style>
  :global(body) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: 100dvh;
    overflow: hidden;
  }

  header:has(h1) {
    display: grid;
    grid-template-columns: 1fr minmax(180px, 240px) 1fr;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    height: 3rem;
    min-height: 3rem;
    background: var(--bg-card);
    border-bottom: var(--border-style);

    & > h1 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--font-size-brand);
      font-weight: normal;
      text-box: trim-both cap alphabetic;
      letter-spacing: 0.1rem;
    }

    & > .text-input {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 1rem;
      align-items: center;
      text-align: left;
      transition:
        scale 0.15s,
        box-shadow 0.15s;

      &:hover {
        box-shadow: 0 0 0 0.25rem var(--bg-active);
      }

      &:active {
        scale: 0.97;
      }
    }
  }

  /* --- */

  header:not(:has(h1)) {
    height: 2.5rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    border-bottom: var(--border-style);
    margin-bottom: 0.5rem;

    & > span {
      font-family: var(--font-mono);
      font-size: var(--font-size-caption);
      color: var(--text-dim);
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
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    row-gap: 0.25rem;
    column-gap: 0.75rem;
    align-items: start;
    padding: 0.5rem 0.75rem;
    border-radius: calc(var(--radius));
    background-color: transparent;

    &:hover {
      background-color: var(--bg-hover);
    }

    &.active {
      background-color: var(--bg-hover);

      &:hover {
        background-color: var(--bg-active);
      }
    }

    &.active::after {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background-color: var(--accent);
      border-radius: 999px;
    }

    & > span {
      grid-row: 1 / 3;
      display: grid;
      place-items: center;
      padding-top: 0.15rem;
    }

    & > h2 {
      color: var(--text);
      font-size: var(--font-size-title2);
      font-weight: 500;
      text-align: left;
    }

    & > p {
      grid-column: 2;
      color: var(--text-muted);
      font-size: var(--font-size-body1);
      text-align: left;
    }
  }
</style>
