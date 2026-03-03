<script lang="ts">
  import { IconFileSearch, IconFileAlert, IconTag, IconDatabase, IconTrashX } from "@tabler/icons-svelte";
  import { api } from "$lib/client/api.js";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import RenameTagModal from "./RenameTagModal.svelte";
  import type { TagInfo } from "$lib/types.js";

  let {
    show = $bindable(false),
    allTags,
    ontagschanged,
  }: {
    show: boolean;
    allTags: TagInfo[];
    ontagschanged?: () => void;
  } = $props();

  let showRenameModal = $state(false);

  let toolResult = $state("");
  let confirmModal = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);

  // Reset result when modal opens
  $effect(() => {
    if (show) toolResult = "";
  });

  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmModal = { message, resolve };
    });
  }

  function handleConfirmOk() {
    confirmModal?.resolve(true);
    confirmModal = null;
  }

  function handleConfirmCancel() {
    confirmModal?.resolve(false);
    confirmModal = null;
  }

  function close() {
    show = false;
  }

  async function checkOrphans() {
    toolResult = "檢查中...";
    const res = await api.get<{ orphans: string[] }>("/api/maintenance/orphans");
    if (res.ok && res.data) {
      const orphans = res.data.orphans;
      if (orphans.length === 0) {
        toolResult = "✓ 沒有找到孤立檔案";
      } else {
        toolResult = `找到 ${orphans.length} 個孤立檔案:\n${orphans.map((f) => "  • " + f).join("\n")}`;
      }
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function checkMissing() {
    toolResult = "檢查中...";
    const res = await api.get<{ missing: string[] }>("/api/maintenance/missing");
    if (res.ok && res.data) {
      const missing = res.data.missing;
      if (missing.length === 0) {
        toolResult = "✓ 沒有找到缺失檔案";
      } else {
        toolResult = `找到 ${missing.length} 個缺失記錄:\n${missing.map((m) => "  • " + m).join("\n")}`;
      }
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  function openRenameModal() {
    showRenameModal = true;
  }

  async function handleRename(oldName: string, newName: string) {
    toolResult = "重命名中...";
    const res = await api.post<{ affected: number }>("/api/metadata/tags", {
      oldName,
      newName,
    });
    if (res.ok && res.data) {
      toolResult = `✓ 已將「${oldName}」重命名為「${newName}」，影響 ${res.data.affected} 張圖片`;
      ontagschanged?.();
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function backup() {
    toolResult = "備份中...";
    const res = await api.post<{ backupPath: string }>("/api/maintenance/backup");
    if (res.ok && res.data) {
      toolResult = "✓ 備份完成: " + res.data.backupPath;
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function emptyTrash() {
    const ok = await confirmDialog("確定要清空垃圾桶？此操作無法復原。");
    if (!ok) return;

    toolResult = "清空中...";
    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok && res.data) {
      toolResult = `✓ 已清空垃圾桶，刪除 ${res.data.deleted} 個檔案`;
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
  >
    <div class="modal" style="max-width:36rem">
      <div class="modal-title">工具</div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:0.5rem">
        <button class="btn" onclick={checkOrphans}>
          <IconFileSearch size={16} />
          檢查孤立檔案
        </button>
        <button class="btn" onclick={checkMissing}>
          <IconFileAlert size={16} />
          檢查缺失檔案
        </button>
        <button class="btn" onclick={openRenameModal}>
          <IconTag size={16} />
          標籤重命名
        </button>
        <button class="btn" onclick={backup}>
          <IconDatabase size={16} />
          資料庫備份
        </button>
        <button class="btn btn-destructive" onclick={emptyTrash}>
          <IconTrashX size={16} />
          清空垃圾桶
        </button>
      </div>
      <div class="modal-actions" style="margin-top:1rem">
        <button class="btn" onclick={close}>關閉</button>
      </div>
      {#if toolResult}
        <div class="tools-result">
          {toolResult}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if confirmModal}
  <ConfirmModal message={confirmModal.message} onconfirm={handleConfirmOk} oncancel={handleConfirmCancel} />
{/if}

<RenameTagModal bind:show={showRenameModal} {allTags} onrename={handleRename} />

<style>
  .tools-result {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
    white-space: pre-wrap;
  }
</style>
