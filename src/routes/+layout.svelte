<script lang="ts">
  import "$lib/styles/app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  import { IconAlbum, IconCaretDownFilled, IconCompassFilled } from "@tabler/icons-svelte";
  import { IconPhotoFilled, IconSettings2, IconTagFilled, IconTagsFilled } from "@tabler/icons-svelte";
  import { IconArrowLeft, IconArrowRight } from "@tabler/icons-svelte";
  import { Modal } from "$lib/ui/modal.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { children } = $props();

  const navItems = [
    {
      href: "/browse",
      Icon: IconPhotoFilled,
      name: "瀏覽圖片",
      desc: "以瀑布流、播放器、隨機抽選等多種方式探索已提交的圖片",
    },
    {
      href: "#tags",
      Icon: IconTagsFilled,
      name: "瀏覽標籤",
      desc: "敬請期待",
    },
    {
      href: "/tagger",
      Icon: IconTagFilled,
      name: "新增圖片",
      desc: "審查並提交暫存的圖片",
    },
    {
      href: "/editor",
      Icon: IconAlbum,
      name: "管理圖片",
      desc: "編輯已提交圖片的名稱、標籤或評分",
    },
    {
      href: "/settings",
      Icon: IconSettings2,
      name: "設定",
      desc: "調整應用的行為、修復圖片資料或是製作備份",
    },
  ];

  const currentDisplayValue = $derived.by(() => {
    const path = page.url.pathname;

    if (path === "/browse") return "正在 探索圖片";
    if (path === "/browse/compare") return "正在 比較圖片";
    // if (path === "#tags") return "探索標籤"; WIP
    if (path === "/tagger") return "正在 審查圖片";
    if (path === "/editor") {
      const searchParams = page.url.searchParams;
      if (searchParams.has("currentId")) {
        return `正在 編輯 ${searchParams.get("currentId")}`;
      } else {
        return "正在 編輯已提交圖片";
      }
    }
    if (path === "/settings") return "正在 調整設定";

    return path;
  });

  const currentActiveItem = $derived.by(() => {
    const path = page.url.pathname;

    if (path === "/browse" || path === "/browse/compare" || path === "/browse/player") return "/browse";
    if (path === "/tagger") return "/tagger";
    if (path === "/editor") return "/editor";
    if (path === "/settings") return "/settings";

    return null;
  });

  let open = $state(false);

  const handleTogglePalette = () => {
    open = !open;
  };

  const modal = new Modal({
    get open() {
      return open;
    },
    onclose: () => {
      open = false;
    },
  });

  const handleNavigateForward = () => {
    history.forward();
    handleTogglePalette();
  };

  const handleNavigateBack = () => {
    history.back();
    handleTogglePalette();
  };
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if !page.url.pathname.includes("player")}
  <header>
    <h1>
      <img src={favicon} alt="網站圖示" />
      Taggit
    </h1>

    {#if !open}
      <button
        class="text-input"
        onclick={handleTogglePalette}
        transition:fly={{ duration: 200, y: 35, easing: cubicOut }}
      >
        <IconCompassFilled size={20} />
        <span class="ellipsis">{currentDisplayValue}</span>
        <IconCaretDownFilled size={20} color="var(--text-muted)" />
      </button>
    {/if}
  </header>
{/if}

{@render children()}

{#if open}
  <div
    class="modal-overlay"
    role="presentation"
    onclick={modal.handleOverlayClick}
    onkeydown={modal.handleOverlayKeydown}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="導航選單"
      bind:this={modal.dialogEl}
      transition:fly={{ duration: 200, y: -35, easing: cubicOut }}
    >
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
    </div>
  </div>
{/if}

<ConfirmModal />
<Toast />

<style>
  :global(body) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: 100dvh;
    overflow-x: auto;
    overflow-y: hidden;
  }

  header:has(h1) {
    display: grid;
    grid-template-columns: 1fr minmax(180px, 240px) 1fr;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    height: 3rem;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);

    & > h1 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.5rem;
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
    }
  }

  /* --- */

  .modal-overlay {
    position: fixed;
    inset: 0;
    backdrop-filter: blur(3px) brightness(0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .modal {
    background: var(--bg-card);
    border: 2px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    padding: 0.5rem;
    max-width: 32rem;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal > header {
    height: 2.5rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    border-bottom: 1px solid var(--border);

    & > span {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
    }
  }
  /* --- */

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
      font-size: 1rem;
      font-weight: 500;
      text-align: left;
    }

    & > p {
      grid-column: 2;
      color: var(--text-muted);
      font-size: 0.875rem;
      text-align: left;
    }
  }
</style>
