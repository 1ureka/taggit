<script lang="ts">
  import { IconAlertCircleFilled, IconCheckFilled, IconArrowBackUpDouble } from "$lib/icons";

  type Item = {
    /** 已編輯資訊的狀態 */
    kind: "not-ready" | "ready";
    /** 已編輯資訊的名稱 */
    name: string;
    /** 已編輯資訊的評分 */
    rating: number;
    /** 已編輯資訊的標籤數量 */
    tagCount: number;
  };

  type Props = {
    /** 項目對應的圖片檔名 */
    filename: string;
    /** 項目目前的標記、編輯狀態 */
    info?: Item | "reverted";
  };

  let { filename, info }: Props = $props();

  const icon = $derived.by(() => {
    if (!info) return null;

    const kind = info === "reverted" ? "reverted" : info.kind;

    const Component = {
      reverted: IconArrowBackUpDouble,
      "not-ready": IconAlertCircleFilled,
      ready: IconCheckFilled,
    }[kind];

    const color = {
      reverted: "var(--color-error)",
      "not-ready": "var(--color-warning)",
      ready: "var(--color-success)",
    }[kind];

    return { Component, color };
  });
</script>

<div class="container">
  <div>
    <span class="ellipsis">{filename}</span>
    {#if icon}
      <span class="mark">
        <icon.Component size={14} color={icon.color} />
      </span>
    {/if}
  </div>

  {#if info === "reverted"}
    <div>
      <span>將退回暫存區</span>
    </div>
  {:else if info}
    <div>
      {#if info.rating > 0}<span>★{info.rating}</span>{/if}
      {#if info.tagCount > 0}<span>{info.tagCount} 標籤</span>{/if}
      {#if info.name}<span class="ellipsis">「{info.name.trim()}」</span>{/if}
    </div>
  {/if}
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    padding-bottom: 0.375rem;
    gap: 0.5rem;
    min-width: 0;
  }

  div.container > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  div.container > div:nth-of-type(1) {
    & > span.ellipsis {
      flex: 1;
      font: var(--font-caption);
      color: var(--color-text-muted);
    }

    & > span.mark {
      display: inline-flex;
      flex-shrink: 0;
    }
  }

  div.container > div:nth-of-type(2) {
    font: var(--font-caption);
    color: var(--color-text-muted);

    & > span:not(.ellipsis) {
      flex-shrink: 0;
    }
  }
</style>
