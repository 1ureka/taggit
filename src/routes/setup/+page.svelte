<script lang="ts">
  import { untrack } from "svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // URL search params for alert state
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const alert = params.get("alert");

  // untrack: intentionally initialize state from props once (form field the user will edit)
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
      message = json.error ?? "Unknown error";
    }
  }
</script>

<svelte:head>
  <title>Setup — Image Manager</title>
</svelte:head>

<main style="max-width:480px;margin:80px auto;padding:0 16px;font-family:sans-serif">
  <h1>Image Manager — Setup</h1>

  {#if alert === "default"}
    <p style="background:#fff3cd;border:1px solid #ffc107;padding:12px;border-radius:4px">
      ⚠️ No collection path configured yet. Please set one below to continue.
    </p>
  {:else if alert === "error"}
    <p style="background:#f8d7da;border:1px solid #dc3545;padding:12px;border-radius:4px">
      ❌ The configured collection path is invalid or inaccessible. Please update it.
    </p>
  {/if}

  <form onsubmit={submit}>
    <label for="root" style="display:block;margin-bottom:4px;font-weight:bold"> Collection root path </label>
    <input
      id="root"
      type="text"
      bind:value={collectionRoot}
      placeholder="e.g. C:/Users/you/Pictures/tagged"
      style="width:100%;box-sizing:border-box;padding:8px;font-size:1rem;border:1px solid #ccc;border-radius:4px"
    />

    {#if message}
      <p style="color:{isError ? '#dc3545' : '#198754'};margin-top:8px">
        {message}
      </p>
    {/if}

    <button
      type="submit"
      disabled={saving}
      style="margin-top:16px;padding:10px 24px;font-size:1rem;background:#0d6efd;color:#fff;border:none;border-radius:4px;cursor:pointer"
    >
      {saving ? "Saving…" : "Save & Continue"}
    </button>
  </form>

  <p style="margin-top:32px;color:#666;font-size:.85rem">
    The path must point to a directory. The subdirectories <code>staged/</code>,
    <code>committed/</code>, and <code>trash/</code> will be created automatically if missing.
  </p>
</main>
