<script lang="ts">
  import { getCollectionContext } from "../logic/collection.svelte";

  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  const collection = getCollectionContext();

  const id = $props.id();
</script>

<p class="intro">
  設定圖片集的根目錄。此路徑下會自動建立 <code>images/</code> 子目錄存放所有圖片，並以
  <code>db.json</code> 作為唯一的紀錄檔。
</p>

{#if collection.alert}
  <p class={{ alert: true, error: collection.alert.error }}>{collection.alert.message}</p>
{/if}

<form onsubmit={collection.handleSubmit}>
  <TextInput
    size="md"
    label="圖片集根目錄"
    bind:value={collection.inputValue}
    placeholder="例如 C:/Users/you/Pictures/tagged"
    autocomplete="off"
    status={collection.errorMessage ? "error" : undefined}
    aria-describedby={collection.errorMessage ? `${id}-error` : `${id}-hint`}
    onkeydown={collection.handleKeydown}
    oninput={collection.handleInput}
  />

  {#if collection.errorMessage}
    <span id="{id}-error" class="helper error">{collection.errorMessage}</span>
  {:else}
    <span id="{id}-hint" class="helper">
      {collection.historyHint}
      {#if collection.history.length > 0}
        <button type="button" class="link-btn" onclick={collection.handleClearHistory}>清空</button>
      {/if}
    </span>
  {/if}

  <footer>
    <Button type="submit" variant="primary" status={collection.saving ? "pending" : undefined}>儲存</Button>
  </footer>
</form>

<style>
  .intro {
    font: var(--font-body1);
    color: var(--color-text-muted);
    margin-bottom: 1rem;

    & > code {
      background-color: var(--color-bg-active);
      padding: 0.125rem 0.375rem;
      border-radius: calc(var(--border-radius) * 2 / 3);
      font: var(--font-kbd);
      font-size: 0.75rem;
    }
  }

  .alert {
    font: var(--font-body2);
    color: var(--color-info);
    background-color: hsl(from var(--color-info) h s l / 0.1);
    border: var(--border-style);
    border-color: hsl(from var(--color-info) h s l / 0.5);
    border-radius: var(--border-radius);
    padding: 0.5rem 0.75rem;
    margin-bottom: 1.25rem;

    &.error {
      color: var(--color-error);
      background-color: hsl(from var(--color-error) h s l / 0.1);
      border-color: hsl(from var(--color-error) h s l / 0.5);
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .helper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font: var(--font-caption);
    line-height: 2;
    color: var(--color-text-muted);

    &.error {
      color: var(--color-error);
    }
  }

  .link-btn {
    font: inherit;
    line-height: inherit;
    color: var(--color-text-muted);
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: var(--color-text);
    }
  }

  form > footer {
    margin-top: 0.5rem;
    display: flex;
  }
</style>
