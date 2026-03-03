<script lang="ts">
  import { untrack } from "svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import Alert from "$lib/components/Alert.svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const alert = params.get("alert");

  let collectionRoot = $state(untrack(() => data.collectionRoot ?? ""));
  let saving = $state(false);
  let message = $state("");
  let isError = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    saving = true;
    message = "";

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionRoot: collectionRoot.trim() }),
    });
    const json = await res.json();
    saving = false;

    if (json.ok) {
      window.location.href = "/";
    } else {
      isError = true;
      message = json.error ?? "未知錯誤";
    }
  }
</script>

<svelte:head>
  <title>設定 — Image Manager</title>
</svelte:head>

<div class="setup-container slide-up">
  <a href="/" class="setup-back">
    <IconArrowLeft size={16} />
    返回首頁
  </a>

  <h1 class="setup-title">設定</h1>
  <p class="setup-subtitle">設定圖片集根目錄</p>

  {#if alert === "default"}
    <div class="setup-alert">
      <Alert type="default" message="尚未設定圖片集路徑，請在下方設定後繼續。" />
    </div>
  {:else if alert === "invalid"}
    <div class="setup-alert">
      <Alert type="error" message="設定的路徑無效或無法存取，請重新設定。" />
    </div>
  {/if}

  <form onsubmit={submit} class="setup-form">
    <label for="root" class="setup-label">圖片集根目錄</label>
    <input
      id="root"
      type="text"
      class="input"
      bind:value={collectionRoot}
      placeholder="例如 C:/Users/you/Pictures/tagged"
    />

    {#if message}
      <p class="setup-message" class:setup-message-error={isError}>
        {message}
      </p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={saving} style="margin-top:1rem;">
      {saving ? "儲存中…" : "儲存並繼續"}
    </button>
  </form>

  <p class="setup-hint">
    路徑必須指向一個資料夾。子目錄 <code>staged/</code>、<code>committed/</code> 以及 <code>trash/</code> 會在缺少時自動建立。
  </p>
</div>

<style>
  .setup-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .setup-back {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-dim);
    font-size: 0.8125rem;
    margin-bottom: 2rem;
    transition: color 0.15s;
  }

  .setup-back:hover {
    color: var(--text-muted);
  }

  .setup-title {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .setup-subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .setup-alert {
    margin-bottom: 1.5rem;
  }

  .setup-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .setup-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
  }

  .setup-message {
    font-size: 0.8125rem;
    color: #22c55e;
    margin-top: 0.25rem;
  }

  .setup-message-error {
    color: var(--destructive);
  }

  .setup-hint {
    margin-top: 2rem;
    color: var(--text-dim);
    font-size: 0.8125rem;
    line-height: 1.6;
  }

  .setup-hint code {
    font-family: var(--font-mono);
    background: var(--bg-active);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }
</style>
