<script lang="ts">
  import { page } from "$app/state";
  import { navItems } from "./config";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = { committedCount?: number; stagedCount?: number; onnavigate: () => void };
  let { committedCount, stagedCount, onnavigate }: Props = $props();

  /** 導航項目右側徽章的數字，key 未對應到資料時回傳 undefined（不顯示） */
  const navItemCount = (key: "committed" | "staged" | undefined) => {
    if (key === "committed") return committedCount;
    if (key === "staged") return stagedCount;
    return undefined;
  };

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
</script>

<nav>
  {#each navItems as { href, Icon, name, desc, key } (href)}
    <a class:active={href === currentActiveItem} {href} onclick={onnavigate}>
      <span class="icon"><Icon size={18} /></span>
      <h2>{name}</h2>
      {#if navItemCount(key) !== undefined}
        <span class="badge"><Chip style="font: var(--font-caption);">{navItemCount(key)}</Chip></span>
      {/if}
      <p>{desc}</p>
    </a>
  {/each}
</nav>

<style>
  nav {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  a {
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
    will-change: transform;
    transition: all 0.15s ease;
  }

  a {
    &:active {
      transition: all 0.03s ease;
      transform: scale(0.98);
    }

    &:hover {
      background-color: var(--color-bg-hover);
    }

    &.active {
      background-color: var(--color-bg-hover);

      &:hover {
        background-color: var(--color-bg-active);
      }
    }
  }

  a.active::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--color-accent);
    border-radius: 999px;
  }

  a {
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
      align-self: flex-start;
      justify-self: end;
      overflow: visible;
      height: 0;
    }

    & > p {
      grid-column: 2;
      color: var(--color-text-muted);
      font: var(--font-body2);
      text-align: left;
    }
  }
</style>
