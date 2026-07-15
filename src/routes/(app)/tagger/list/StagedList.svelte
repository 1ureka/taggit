<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 暫存檔案列表 */
    files: string[];
    /** 某張暫存檔案是否已編輯過草稿 */
    isTouched: (file: string) => boolean;
    /** 當前正在編輯草稿的暫存檔案 */
    currentFile: string | null;
  };

  let { files, isTouched, currentFile = $bindable(null) }: Props = $props();
</script>

<!-- TODO: 待重寫 (UI 上，資料留不動) -->

<ul class="staged-list">
  {#each files as file (file)}
    <li>
      <button type="button" class:active={file === currentFile} onclick={() => (currentFile = file)}>
        <span class="name ellipsis">{file}</span>
        {#if isTouched(file)}
          <Chip variant="outlined" style="font: var(--font-caption); flex-shrink: 0;">已編輯</Chip>{/if}
      </button>
    </li>
  {:else}
    <li class="empty">暫存區目前沒有圖片</li>
  {/each}
</ul>

<style>
  .staged-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    list-style: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border-radius: var(--border-radius);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--color-bg-hover);
    }

    &.active {
      background: var(--color-bg-active);
    }
  }

  .name {
    flex: 1;
    min-width: 0;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
  }

  .empty {
    padding: 1rem 0.625rem;
    text-align: center;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }
</style>
