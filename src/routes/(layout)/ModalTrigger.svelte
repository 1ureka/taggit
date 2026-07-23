<script lang="ts">
  import { page } from "$app/state";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  import { IconCompassFilled, IconChevronDown } from "$lib/icons";

  let { onclick }: { onclick: () => void } = $props();

  const description = $derived.by(() => {
    if (page.error) return page.error?.message ?? "發生未知錯誤";

    const path = page.url.pathname;

    if (path === "/") return "正在 探索圖片";
    if (path.startsWith("/compare")) return "正在 比較圖片";
    if (path.startsWith("/staged")) return "正在 準備新紀錄";
    if (path.startsWith("/tags")) return "正在 整理標籤";
    if (path.startsWith("/settings")) return "正在 調整設定";
    if (path.startsWith("/committed")) return "正在 編輯已有紀錄";

    return path;
  });
</script>

<button type="button" class="status" {onclick} transition:fly={{ duration: 200, y: 35, easing: cubicOut }}>
  <IconCompassFilled size={20} />
  <span class="ellipsis">{description}</span>
  <IconChevronDown size={20} color="var(--color-text-muted)" />
</button>

<style>
  .status {
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
</style>
