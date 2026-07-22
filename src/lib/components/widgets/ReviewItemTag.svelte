<script lang="ts">
  import { IconArrowBackUpDouble, IconAlertCircleFilled } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  type Props = {
    /** 項目的種類 */
    kind: "rename" | "merge" | "delete" | "hidden" | "visible";
    /** 項目是否可勾選 */
    checkable: boolean;
    /** 項目是否勾選 */
    checked: boolean;
    /** 項目要操作的標籤 */
    tag: string;
    /** 項目要操作的標籤的使用數量 */
    count: number;
    /** 項目若為重命名或合併的目標標籤 */
    target?: string;
    /** 項目若為重命名或合併的預計合併後使用數量 */
    mergedCount?: number | null;
    /** 項目是否有問題 */
    problem: string | null;
    /** 項目勾選事件 */
    ontoggle: () => void;
    /** 項目撤銷事件 */
    ondiscard: () => void;
  };

  let { kind, checkable, checked, tag, count, target, mergedCount, problem, ontoggle, ondiscard }: Props = $props();

  const kindLabel = { rename: "重命名", merge: "合併", delete: "刪除", hidden: "隱藏", visible: "取消隱藏" };
</script>

{#snippet impact()}
  {#if kind === "rename" || kind === "merge"}
    <span class="impact">
      <del>{tag}</del> → <ins>{target}</ins>
      {#if kind === "merge"}
        <span>（{count} 張併入，合併後共 {mergedCount ?? "..."} 張）</span>
      {:else}
        <span>（{count} 張）</span>
      {/if}
    </span>
  {:else if kind === "delete"}
    <span class="impact">
      <del>{tag}</del>
      <span>（自 {count} 張圖片移除）</span>
    </span>
  {:else if kind === "hidden"}
    <span class="impact">
      {tag}
      <span>（{count} 張，查詢時將被遮蔽）</span>
    </span>
  {:else if kind === "visible"}
    <span class="impact">
      {tag}
      <span>（{count} 張，恢復一般可見）</span>
    </span>
  {/if}
{/snippet}

{#snippet body()}
  <div>
    <div>
      <span class={{ kind: true, [kind]: true }}>{kindLabel[kind]}</span>
      {@render impact()}
    </div>
    {#if problem}
      <span class="problem"><IconAlertCircleFilled size={13} />{problem}</span>
    {/if}
  </div>
{/snippet}

<li class:excluded={!checked}>
  <Checkbox {checked} status={!checkable ? "disabled" : "default"} onchange={ontoggle} aria-label={`包含 ${tag}`} />
  {@render body()}
  <Button
    variant="ghost"
    padding="icon"
    aria-label={`捨棄 ${tag} 的操作`}
    {@attach tooltip({ content: "捨棄這筆操作" })}
    onclick={ondiscard}
  >
    <IconArrowBackUpDouble size={14} />
  </Button>
</li>

<style>
  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0px;
  }

  li.excluded > div {
    opacity: 0.5;
  }

  li > div {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  li > div > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  /* --- */

  span.kind {
    flex-shrink: 0;
    padding: 0.0625rem 0.4375rem;
    font: var(--font-caption);
    border: var(--border-style);
    color: var(--color-text-muted);
    border-radius: 9999px;
  }

  span.kind.merge {
    color: var(--color-accent);
    border-color: hsl(from var(--color-accent) h s l / 0.5);
    background: hsl(from var(--color-accent) h s l / 0.08);
  }

  span.kind.hidden {
    color: var(--color-warning);
    border-color: hsl(from var(--color-warning) h s l / 0.5);
    background: hsl(from var(--color-warning) h s l / 0.08);
  }

  span.kind.delete {
    color: var(--color-error);
    border-color: hsl(from var(--color-error) h s l / 0.5);
    background: hsl(from var(--color-error) h s l / 0.08);
  }

  /* --- */

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

  /* --- */

  span.problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
