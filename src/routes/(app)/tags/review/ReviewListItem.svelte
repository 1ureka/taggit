<script lang="ts">
  import { IconArrowBackUpDouble, IconAlertCircleFilled } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  import type { ReviewEntry } from "./reviewEntry";
  import ReviewImpact from "./ReviewImpact.svelte";

  type Props = {
    /** 這一列的完整審查條目 */
    entry: ReviewEntry;
    /** 是否可撤銷 */
    discardable: boolean;
    /** 勾選事件 */
    ontoggle: () => void;
    /** 撤銷事件 */
    ondiscard: () => void;
  };

  let { entry, discardable, ontoggle, ondiscard }: Props = $props();

  const kindLabel = { rename: "重命名", merge: "合併", delete: "刪除", hidden: "隱藏", visible: "取消隱藏" };
</script>

<li class:excluded={!entry.checked}>
  <Checkbox
    checked={entry.checked}
    status={!entry.checkable ? "disabled" : "default"}
    onchange={ontoggle}
    aria-label={`包含 ${entry.name}`}
  />

  <div class="info">
    <div>
      <span class={{ kind: true, [entry.kind]: true }}>{kindLabel[entry.kind]}</span>
      <ReviewImpact {entry} />
    </div>
    {#if entry.problem}
      <span class="problem"><IconAlertCircleFilled size={13} />{entry.problem}</span>
    {/if}
  </div>

  <Button
    variant="ghost"
    padding="icon"
    aria-label={`捨棄 ${entry.name}`}
    status={!discardable ? "disabled" : undefined}
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

  li.excluded > div.info {
    opacity: 0.5;
  }

  div.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  div.info > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

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

  span.kind.delete {
    color: var(--color-error);
    border-color: hsl(from var(--color-error) h s l / 0.5);
    background: hsl(from var(--color-error) h s l / 0.08);
  }

  span.problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
