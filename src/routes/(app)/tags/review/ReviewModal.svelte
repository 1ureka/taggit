<script lang="ts">
  import { IconAlertCircleFilled, IconArrowBackUpDouble } from "$lib/icons";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import type { ChangeEntry } from "../logic/changeset";
  import ReviewHeader from "./ReviewHeader.svelte";
  import ReviewFooter from "./ReviewFooter.svelte";

  /** 審查條目加上勾選與失敗狀態（由頁面組好） */
  type ReviewEntry = ChangeEntry & {
    checked: boolean;
    failure?: string;
  };

  type Props = {
    /** 是否開啟審查對話框 */
    open: boolean;
    /** 待送出的操作清單 */
    entries: ReviewEntry[];
    /** 是否正在送出 */
    pending: boolean;
    /** 預估是否更新中（開啟時會重查一次最新預估） */
    previewPending: boolean;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 送出事件 */
    onsubmit: () => void;
    /** 點擊操作勾選框事件 */
    ontoggle: (key: string) => void;
    /** 點擊全選勾選框事件 */
    ontoggleall: () => void;
    /** 捨棄單筆操作（自畫布移除） */
    ondiscard: (key: string) => void;
  };

  let { open, entries, pending, previewPending, onclose, onsubmit, ontoggle, ontoggleall, ondiscard }: Props = $props();

  const checkedCount = $derived(entries.filter((e) => e.checked).length);
  const checkableCount = $derived(entries.filter((e) => e.problem === null).length);

  const bulkSelectionState = $derived.by(() => {
    if (checkableCount === 0 || checkedCount === 0) return "unchecked";
    if (checkableCount === checkedCount) return "checked";
    return "indeterminate";
  });

  const kindLabel = (e: ChangeEntry) => {
    if (e.kind === "rename") return e.merge ? "合併" : "重命名";
    if (e.kind === "delete") return "刪除";
    return e.hidden ? "隱藏" : "取消隱藏";
  };

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal {open} {onclose} aria-label="檢視待送出的標籤變更" containerProps={{ style: containerStyle }}>
  <ReviewHeader {previewPending} />

  {#if entries.length === 0}
    <p class="empty">目前沒有任何未送出的標籤操作。</p>
  {:else}
    <ul>
      <li class="select-all">
        <Checkbox
          checked={bulkSelectionState === "checked"}
          indeterminate={bulkSelectionState === "indeterminate"}
          status={checkableCount === 0 || pending ? "disabled" : "default"}
          onchange={ontoggleall}
          aria-label="全選可送出的操作"
        />
        <span>全選</span>
        <span>{checkedCount} / {checkableCount} 可送出操作已選取</span>
      </li>

      {#each entries as entry (entry.key)}
        <li class:excluded={!entry.checked}>
          <Checkbox
            checked={entry.checked}
            status={entry.problem !== null || pending ? "disabled" : "default"}
            onchange={() => ontoggle(entry.key)}
            aria-label={`包含 ${entry.key}`}
          />

          <div class="info">
            <div class="line">
              <span
                class="op"
                class:op-delete={entry.kind === "delete"}
                class:op-merge={entry.kind === "rename" && entry.merge}
              >
                {kindLabel(entry)}
              </span>

              {#if entry.kind === "rename"}
                <span class="change">
                  <del>{entry.name}</del> → <ins>{entry.to}</ins>
                  {#if entry.merge && entry.mergedCount !== undefined}
                    <span class="meta">（{entry.count} 張併入，合併後共 {entry.mergedCount} 張）</span>
                  {:else}
                    <span class="meta">（{entry.count} 張）</span>
                  {/if}
                </span>
              {:else if entry.kind === "delete"}
                <span class="change">
                  <del>{entry.name}</del>
                  <span class="meta">（自 {entry.count} 張圖片移除）</span>
                </span>
              {:else}
                <span class="change">
                  {entry.name}
                  <span class="meta">（{entry.count} 張，{entry.hidden ? "查詢時將被遮蔽" : "恢復一般可見"}）</span>
                </span>
              {/if}
            </div>

            {#if entry.problem}
              <span class="problem"><IconAlertCircleFilled size={13} />{entry.problem}</span>
            {:else if entry.failure}
              <span class="problem"><IconAlertCircleFilled size={13} />送出失敗：{entry.failure}</span>
            {/if}
          </div>

          <Button
            variant="ghost"
            padding="icon"
            aria-label={`捨棄 ${entry.key}`}
            title="捨棄這筆操作"
            status={pending ? "disabled" : undefined}
            onclick={() => ondiscard(entry.key)}
          >
            <IconArrowBackUpDouble size={14} />
          </Button>
        </li>
      {/each}
    </ul>
  {/if}

  <ReviewFooter checked={checkedCount} {pending} {onclose} {onsubmit} />
</Modal>

<style>
  .empty {
    font: var(--font-body1);
    color: var(--color-text-muted);
    padding: 2.5rem 1rem;
    text-align: center;
  }

  /* ─── 操作清單 ─── */

  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 50vh;
    overflow-y: auto;
    padding: 0.5rem 1rem;
  }

  ul > li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0px;

    &.excluded > * {
      opacity: 0.5;
    }
  }

  li.select-all {
    padding: 0.25rem 0px;
  }

  li.select-all > span:nth-of-type(1) {
    font: var(--font-body2);
  }

  li.select-all > span:nth-of-type(2) {
    margin-left: auto;
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  /* ─── 條目內容 ─── */

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .op {
    flex-shrink: 0;
    padding: 0.0625rem 0.4375rem;
    font: var(--font-caption);
    border-radius: 9999px;
    border: var(--border-style);
    color: var(--color-text-muted);
  }

  .op-delete {
    color: var(--color-error);
    border-color: hsl(from var(--color-error) h s l / 0.5);
    background: hsl(from var(--color-error) h s l / 0.08);
  }

  .op-merge {
    color: var(--color-info);
    border-color: hsl(from var(--color-info) h s l / 0.5);
    background: hsl(from var(--color-info) h s l / 0.08);
  }

  .change {
    font: var(--font-body2);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;

    & del {
      color: var(--color-text-muted);
      opacity: 0.7;
      text-decoration: line-through;
    }

    & ins {
      color: var(--color-text);
      text-decoration: none;
    }

    & > .meta {
      color: var(--color-text-muted);
      font: var(--font-caption);
    }
  }

  .problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
