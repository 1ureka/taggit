<script lang="ts">
  import type { Suggestion } from "../logic/suggestions";

  let { suggestion: s }: { suggestion: Suggestion } = $props();
</script>

<div>
  {#if s.kind === "similar" || s.kind === "cooccur"}
    {@const a = s.a}
    {@const b = s.b}
    {@const both = s.both}

    <p class="subject">
      <b>{a.name}</b><span class="count">{a.count}</span>
      <span class="vs">×</span>
      <b>{b.name}</b><span class="count">{b.count}</span>
    </p>

    <p class="evidence">
      {#if s.kind === "similar"}
        {s.reason}{both > 0 ? `；${both} 張圖片同時擁有兩者` : "；沒有圖片同時擁有兩者"}
      {:else}
        {both} 張同時擁有兩者，重疊率 {Math.round(s.jaccard * 100)}%，可能是同義標籤
      {/if}
    </p>
  {:else if s.kind === "rare"}
    {@const tag = s.tag}
    {@const topCo = s.topCo}

    <p class="subject">
      <b>{tag.name}</b><span class="count">{tag.count}</span>
    </p>

    <p class="evidence">
      使用次數較少的標籤，
      {#if topCo}
        最常與「{topCo.tag.name}」一起同時出現 {topCo.both} 次
      {:else}
        沒有明顯的共現標籤
      {/if}
    </p>
  {:else}
    <p class="subject">
      <b>{s.tag.name}</b><span class="count">0</span>
    </p>

    <p class="evidence">只剩元資料的標籤、沒有任何圖片使用</p>
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0rem 0.75rem;
  }

  p.subject {
    flex-shrink: 0;
    font: var(--font-body1);
    overflow-wrap: anywhere;
  }

  p.subject > b {
    font-weight: 600;
  }

  p.subject > .count {
    color: var(--color-text-muted);
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    margin: 0 0.25rem;
  }

  p.subject > .vs {
    color: var(--color-text-muted);
    margin: 0 0.25rem;
  }

  p.evidence {
    flex-shrink: 1;
    min-height: 0;
    font: var(--font-body2);
    color: var(--color-text-muted);
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>
