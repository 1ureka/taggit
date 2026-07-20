<script lang="ts">
  import { IconPinFilled, IconPinnedOff } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import { getEditorContext } from "../logic/editor.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";
  import { getStampContext } from "../logic/stamp.svelte";

  const id = $props.id();

  const editor = getEditorContext();
  const operations = getOperationsContext();
  const stamp = getStampContext();

  const clearStatus = $derived(operations.pending ? "disabled" : undefined);
  const deleteStatus = $derived(operations.pending ? "pending" : undefined);
</script>

{#snippet stampEntry()}
  <div>
    <Button variant="outlined" onclick={stamp.handlePin} status={stamp.canPin ? undefined : "disabled"}>
      <IconPinFilled size={14} />
      <span>以此張設為圖章</span>
    </Button>
    <p id={`stamp-hint-${id}`}>釘選為圖章，於網格上點擊或拖曳連續套用到其他卡片。</p>
  </div>
{/snippet}

{#snippet stampControl({ name, rating, tags, include }: NonNullable<typeof stamp.active>)}
  <div>
    <Button variant="outlined" onclick={stamp.handleExit}>
      <IconPinnedOff size={14} />
      <span>取消圖章</span>
    </Button>

    <div class="fields">
      <p>請選擇要套用的欄位：</p>

      <Checkbox
        size="sm"
        bind:checked={include.name}
        label={`名稱・${name ? `「${name}」` : "（留空，套用後清空名稱）"}`}
      />
      <Checkbox size="sm" bind:checked={include.rating} label={`評等・★${rating}`} />
      <Checkbox size="sm" bind:checked={include.tags} label={`標籤・${tags.length > 0 ? tags.join("、") : "（無）"}`} />
    </div>
  </div>
{/snippet}

{#snippet stampTool()}
  <div style="grid-column: span 2;">
    {#if stamp.active === null}
      {@render stampEntry()}
    {:else}
      {@render stampControl(stamp.active)}
    {/if}
  </div>
{/snippet}

<footer>
  <Button variant="outlined" status={clearStatus} onclick={editor.handleClear}>清空草稿</Button>
  <Button variant="destructive" status={deleteStatus} onclick={editor.handleDelete}>刪除此張</Button>
  {@render stampTool()}
</footer>

<style>
  footer {
    padding: 0.75rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
    gap: 0.5rem;
    margin-top: auto;
  }

  div:has(> p[id]) {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.25rem;
  }

  p[id] {
    font: var(--font-caption);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  div:has(> div.fields) {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.5rem;
  }

  div.fields {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: var(--border-style);
    border-radius: var(--border-radius);
    background-color: var(--color-bg-card);
  }
</style>
