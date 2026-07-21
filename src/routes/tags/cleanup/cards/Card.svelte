<script lang="ts">
  import type { Suggestion } from "../logic/suggestions";
  import { IconX } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";
  import { getFilterContext, KIND_LABELS } from "../logic/filter.svelte";
  import CardSamples from "./CardSamples.svelte";

  let { suggestion: s }: { suggestion: Suggestion } = $props();

  const schedule = getScheduleContext();
  const filter = getFilterContext();

  /** 這張卡片涉及的標籤名稱，用來判斷是否已有排入的操作 */
  const names = $derived(s.kind === "similar" || s.kind === "cooccur" ? [s.a.name, s.b.name] : [s.tag.name]);
  const scheduledName = $derived(names.find((n) => schedule.statusOf(n) !== null));
</script>

<article class:scheduled={scheduledName !== undefined}>
  <header>
    <span class="kind kind-{s.kind}">{KIND_LABELS[s.kind]}</span>
    <span class="spacer"></span>
    {#if scheduledName !== undefined}
      <span class="scheduled-mark">已排入</span>
    {/if}
    <Button
      variant="ghost"
      padding="icon"
      aria-label="忽略這個建議"
      onclick={() => filter.handleDismiss(s.id)}
    >
      <IconX size={13} />
    </Button>
  </header>

  {#if s.kind === "similar" || s.kind === "cooccur"}
    {@const a = s.a}
    {@const b = s.b}
    {@const both = s.both}
    <p class="subject">
      <b>{a.name}</b><span class="count">（{a.count}）</span>
      <span class="vs">×</span>
      <b>{b.name}</b><span class="count">（{b.count}）</span>
    </p>
    <p class="evidence">
      {#if s.kind === "similar"}
        {s.reason}{both > 0 ? `；${both} 張圖片同時擁有兩者` : "；沒有圖片同時擁有兩者"}
      {:else}
        {both} 張同時擁有兩者，重疊率 {Math.round(s.jaccard * 100)}%——可能是同義標籤
      {/if}
    </p>
  {:else if s.kind === "rare"}
    {@const tag = s.tag}
    {@const topCo = s.topCo}
    <p class="subject">
      <b>{tag.name}</b><span class="count">（只用了 {tag.count} 次）</span>
    </p>
    <p class="evidence">
      {#if topCo}
        最常與「{topCo.tag.name}」一起出現（{topCo.both} 次）
      {:else}
        沒有明顯的共現標籤
      {/if}
    </p>
  {:else}
    <p class="subject">
      <b>{s.tag.name}</b><span class="count">（0 張使用）</span>
    </p>
    <p class="evidence">只剩顯隱設定、沒有任何圖片使用，可安全刪除元資料</p>
  {/if}

  {#if s.kind !== "unused"}
    <CardSamples suggestion={s} />
  {/if}

  <footer>
    {#if scheduledName !== undefined}
      {@const target = scheduledName}
      <Button variant="ghost" padding="sm" onclick={() => schedule.handleUndo(target)}>復原排程</Button>
    {:else if s.kind === "similar" || s.kind === "cooccur"}
      {@const a = s.a}
      {@const b = s.b}
      {@const both = s.both}
      <Button variant="outlined" padding="sm" onclick={() => schedule.handleScheduleMerge(a.name, b.name, a.count, b.count, both)}>
        合併 →「{b.name}」
      </Button>
      <Button variant="outlined" padding="sm" onclick={() => schedule.handleScheduleMerge(b.name, a.name, b.count, a.count, both)}>
        合併 →「{a.name}」
      </Button>
    {:else if s.kind === "rare"}
      {@const tag = s.tag}
      {@const topCo = s.topCo}
      {#if topCo}
        {@const co = topCo}
        <Button
          variant="outlined"
          padding="sm"
          onclick={() => schedule.handleScheduleMerge(tag.name, co.tag.name, tag.count, co.tag.count, co.both)}
        >
          合併 →「{co.tag.name}」
        </Button>
      {/if}
      <Button variant="outlined" padding="sm" onclick={() => schedule.handleScheduleHide(tag.name, tag.count)}>隱藏</Button>
      <Button variant="destructive" padding="sm" onclick={() => schedule.handleScheduleDelete(tag.name, tag.count)}>刪除</Button>
    {:else}
      {@const tag = s.tag}
      <Button variant="destructive" padding="sm" onclick={() => schedule.handleScheduleDelete(tag.name, tag.count)}>
        刪除元資料
      </Button>
    {/if}
  </footer>
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    height: 100%;
    padding: 0.75rem;
    background: var(--color-bg-card);
    border: var(--border-style);
    border-left: 3px solid var(--color-border);
    border-radius: var(--border-radius);
    overflow: hidden;

    &.scheduled {
      border-left-color: var(--color-warning);
    }
  }

  header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .spacer {
    flex: 1;
  }

  .kind {
    display: inline-flex;
    flex-shrink: 0;
    padding: 0.0625rem 0.4375rem;
    font: var(--font-caption);
    border: var(--border-style);
    color: var(--color-text-muted);
    border-radius: 9999px;
  }

  .kind-similar {
    color: var(--color-info);
    border-color: hsl(from var(--color-info) h s l / 0.5);
  }

  .kind-cooccur {
    color: var(--color-success);
    border-color: hsl(from var(--color-success) h s l / 0.5);
  }

  .kind-rare {
    color: var(--color-warning);
    border-color: hsl(from var(--color-warning) h s l / 0.5);
  }

  .kind-unused {
    color: var(--color-text-muted);
  }

  .scheduled-mark {
    flex-shrink: 0;
    font: var(--font-caption);
    color: var(--color-warning);
  }

  .subject {
    flex-shrink: 0;
    font: var(--font-body1);
    overflow-wrap: anywhere;

    & b {
      font-weight: 600;
    }

    & > .count {
      color: var(--color-text-muted);
      font: var(--font-caption);
    }

    & > .vs {
      color: var(--color-text-muted);
      margin: 0 0.25rem;
    }
  }

  .evidence {
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

  footer {
    display: flex;
    flex-wrap: wrap;
    flex-shrink: 0;
    gap: 0.375rem;
    margin-top: auto;
    padding-top: 0.25rem;
  }
</style>
