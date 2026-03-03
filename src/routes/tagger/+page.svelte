<script lang="ts">
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<div class="slide-up" style="padding:2rem;text-align:center;color:var(--text-dim);">
  <h1 style="font-size:1.25rem;font-weight:600;margin-bottom:0.5rem;">Tagger</h1>
  <p>審查並標記新圖片 — 尚未實作</p>
</div>
