<script lang="ts">
  type Props = {
    /** 項目的種類 */
    kind: "rename" | "merge" | "delete" | "visible" | "hidden";
    /** 項目的名稱 */
    name: string;
    /** 項目的使用量 */
    count: number;
    /** 重命名或合併的目標名稱 */
    mergedTo?: string;
    /** 合併後的使用量 */
    mergedCount?: number;
  };

  let { kind, name, count, mergedTo, mergedCount }: Props = $props();
</script>

{#if kind === "rename" && mergedTo !== undefined}
  <span class="impact">
    <del>{name}</del> → <ins>{mergedTo}</ins>
    <span>（{count} 張）</span>
  </span>
{:else if kind === "merge" && mergedTo !== undefined}
  <span class="impact">
    <del>{name}</del> → <ins>{mergedTo}</ins>
    <span>
      （{count} 張併入，合併後共 {mergedCount ?? "..."} 張）
    </span>
  </span>
{:else if kind === "delete"}
  <span class="impact">
    <del>{name}</del>
    <span>（自 {count} 張圖片移除）</span>
  </span>
{:else if kind === "hidden"}
  <span class="impact">
    {name}
    <span>（{count} 張，查詢時將被遮蔽）</span>
  </span>
{:else if kind === "visible"}
  <span class="impact">
    {name}
    <span>（{count} 張，恢復一般可見）</span>
  </span>
{/if}

<style>
  span.impact {
    font: var(--font-body2);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  span.impact > del {
    color: var(--color-text-muted);
    opacity: 0.7;
    text-decoration: line-through;
  }

  span.impact > ins {
    color: var(--color-text);
    text-decoration: none;
  }

  span.impact > span {
    color: var(--color-text-muted);
    font: var(--font-caption);
  }
</style>
