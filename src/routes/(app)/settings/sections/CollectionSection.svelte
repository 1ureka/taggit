<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { api } from "$lib/utils/request";

  import { getPathHistory, pushPathHistory, clearPathHistory } from "../storage/path-history";
  import { addToast } from "$lib/components/floating/toast-events";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  let { collectionRoot }: { collectionRoot: string } = $props();

  const id = $props.id();

  /** 引導 redirect 帶來的提示訊息 */
  const alert = $derived.by(() => {
    const kind = page.url.searchParams.get("alert");
    if (kind === "default") return { error: false, message: "尚未設定圖片集路徑，請在下方設定後繼續。" };
    if (kind === "error") return { error: true, message: "設定的路徑無效或無法存取，請重新設定。" };
    return null;
  });

  // ---

  // 可覆寫的 derived，使用者輸入時覆寫，load 重跑後回到伺服器值
  let inputValue = $derived(collectionRoot);
  let saving = $state(false);
  let errorMessage = $state("");

  /** 曾成功設定過的路徑歷史（最近優先） */
  let history = $state<string[]>(getPathHistory());
  /** 目前瀏覽到的歷史索引；`-1` 表示未在瀏覽歷史（顯示的是使用者當下輸入） */
  let historyIndex = $state(-1);
  /** 進入歷史瀏覽前，暫存使用者當下輸入，供 ArrowDown 越過最新一筆時還原 */
  let draft = "";

  const historyHint = $derived.by(() => {
    if (history.length === 0) return "尚無使用紀錄";
    if (historyIndex >= 0) return `第 ${historyIndex + 1}/${history.length} 筆歷史紀錄`;
    return `可用 ↑ / ↓ 切換歷史路徑（共 ${history.length} 筆）`;
  });

  const applyHistory = (index: number) => {
    historyIndex = index;
    inputValue = history[index];
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (history.length === 0) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      // 從當下輸入進入歷史時，先暫存草稿以便日後還原
      if (historyIndex === -1) draft = inputValue;
      applyHistory(Math.min(historyIndex + 1, history.length - 1));
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex <= -1) return;
      if (historyIndex === 0) {
        // 越過最新一筆，還原使用者原本的輸入
        historyIndex = -1;
        inputValue = draft;
        return;
      }
      applyHistory(historyIndex - 1);
    }
  };

  /** 使用者手動編輯輸入框時，脫離歷史瀏覽狀態 */
  const handleInput = () => {
    historyIndex = -1;
  };

  const handleClearHistory = () => {
    clearPathHistory();
    history = [];
    historyIndex = -1;
  };

  // ---

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (saving) return;

    saving = true;
    errorMessage = "";

    const root = inputValue.trim();
    const res = await api.post("/api/settings/setup", { collectionRoot: root });
    saving = false;

    if (res.ok) {
      history = pushPathHistory(root);
      historyIndex = -1;
      addToast({ message: "圖片集路徑已儲存", variant: "success" });
      await goto("/settings", { invalidateAll: true });
    } else {
      errorMessage = res.error ?? "未知錯誤";
    }
  };
</script>

<p class="intro">
  設定圖片集的根目錄。此路徑下會自動建立 <code>images/</code> 子目錄存放所有圖片，並以
  <code>db.json</code> 作為唯一的紀錄檔。
</p>

{#if alert}
  <p class={{ alert: true, error: alert.error }}>{alert.message}</p>
{/if}

<form onsubmit={handleSubmit}>
  <TextInput
    label="圖片集根目錄"
    bind:value={inputValue}
    placeholder="例如 C:/Users/you/Pictures/tagged"
    autocomplete="off"
    status={errorMessage ? "error" : undefined}
    aria-describedby={errorMessage ? `${id}-error` : `${id}-hint`}
    onkeydown={handleKeydown}
    oninput={handleInput}
  />

  {#if errorMessage}
    <span id="{id}-error" class="helper error">{errorMessage}</span>
  {:else}
    <span id="{id}-hint" class="helper">
      {historyHint}
      {#if history.length > 0}
        <button type="button" class="link-btn" onclick={handleClearHistory}>清空</button>
      {/if}
    </span>
  {/if}

  <footer>
    <Button type="submit" variant="primary" status={saving ? "pending" : undefined}>儲存</Button>
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
      font: var(--font-code);
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
