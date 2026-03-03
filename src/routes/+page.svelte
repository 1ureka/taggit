<script lang="ts">
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();
  const stats = $derived(data.stats);
</script>

<svelte:head>
  <title>Image Manager</title>
</svelte:head>

<main style="max-width:640px;margin:60px auto;padding:0 16px;font-family:sans-serif">
  <h1>Image Manager</h1>

  <section style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:24px">
    <div style="border:1px solid #dee2e6;border-radius:8px;padding:16px">
      <div style="font-size:2rem;font-weight:bold">{stats.totalImages}</div>
      <div style="color:#6c757d">Committed Images</div>
    </div>
    <div style="border:1px solid #dee2e6;border-radius:8px;padding:16px">
      <div style="font-size:2rem;font-weight:bold">{stats.stagedCount}</div>
      <div style="color:#6c757d">Staged</div>
    </div>
    <div style="border:1px solid #dee2e6;border-radius:8px;padding:16px">
      <div style="font-size:2rem;font-weight:bold">{stats.totalTags}</div>
      <div style="color:#6c757d">Unique Tags</div>
    </div>
    <div style="border:1px solid #dee2e6;border-radius:8px;padding:16px">
      <div style="font-size:2rem;font-weight:bold">{stats.trashCount}</div>
      <div style="color:#6c757d">In Trash</div>
    </div>
  </section>

  <nav style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
    <a href="/tagger" style="padding:10px 20px;background:#0d6efd;color:#fff;border-radius:4px;text-decoration:none"
      >Tagger</a
    >
    <a href="/editor" style="padding:10px 20px;background:#0d6efd;color:#fff;border-radius:4px;text-decoration:none"
      >Editor</a
    >
    <a href="/browse" style="padding:10px 20px;background:#0d6efd;color:#fff;border-radius:4px;text-decoration:none"
      >Browse</a
    >
    <a href="/scroll" style="padding:10px 20px;background:#0d6efd;color:#fff;border-radius:4px;text-decoration:none"
      >Scroll</a
    >
    <a href="/compare" style="padding:10px 20px;background:#0d6efd;color:#fff;border-radius:4px;text-decoration:none"
      >Compare</a
    >
  </nav>

  <footer style="margin-top:48px;padding-top:16px;border-top:1px solid #dee2e6;color:#6c757d;font-size:.85rem">
    <a href="/setup">⚙ Settings</a>
  </footer>
</main>
