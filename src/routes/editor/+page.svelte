<script lang="ts">
  import { goto } from "$app/navigation";
  import { IconArrowLeft, IconDeviceFloppy, IconTrash } from "@tabler/icons-svelte";
  import { addToast } from "$lib/client/toast.js";
  import { api } from "$lib/client/api.js";
  import { debounce } from "$lib/utils.js";
  import { untrack } from "svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { ImageWithId, TagInfo, QueryResult } from "$lib/types.js";
  import type { PageData } from "./$types.js";

  import EditorSearch from "./EditorSearch.svelte";
  import EditorPreview from "./EditorPreview.svelte";
  import EditorInfoPanel from "./EditorInfoPanel.svelte";

  let { data }: { data: PageData } = $props();

  // ─── State ────────────────────────────────────────────────────────────
  let image = $state<ImageWithId | null>(
    untrack(() => {
      const d = data as any;
      return d.mode === "edit" ? (d.image ?? null) : null;
    }),
  );
  let allTags = $state<TagInfo[]>(untrack(() => (data as any).allTags ?? []));
  let currentTags = $state<string[]>(
    untrack(() => {
      const d = data as any;
      return d.mode === "edit" && d.image ? [...d.image.tags] : [];
    }),
  );
  let currentRating = $state(
    untrack(() => {
      const d = data as any;
      return d.mode === "edit" && d.image ? (d.image.rating ?? 0) : 0;
    }),
  );
  let dirty = $state(false);
  let saving = $state(false);
  let lastUpdatedAt = $state(
    untrack(() => {
      const d = data as any;
      return d.mode === "edit" && d.image ? (d.image.updatedAt ?? 0) : 0;
    }),
  );
  let confirmModal = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);

  // ─── Derived ──────────────────────────────────────────────────────────
  let isEditMode = $derived(!!image);
  let previewFilename = $derived(image ? image.id + image.ext : null);
  let previewSrc = $derived(previewFilename ? `/img/committed/${previewFilename}` : "");

  // ─── Confirm helper ───────────────────────────────────────────────────
  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmModal = { message, resolve };
    });
  }

  function handleConfirm() {
    confirmModal?.resolve(true);
    confirmModal = null;
  }

  function handleCancel() {
    confirmModal?.resolve(false);
    confirmModal = null;
  }

  // ─── Navigation ───────────────────────────────────────────────────────
  function selectImage(id: string) {
    goto(`/editor?id=${id}`);
  }

  function goBack() {
    if (isEditMode) {
      goto("/editor");
    } else {
      goto("/");
    }
  }

  // ─── Load image when page data changes (SvelteKit navigation) ─────────
  $effect(() => {
    const d = data as any;
    if (d.mode === "edit" && d.image) {
      image = d.image;
      currentTags = [...d.image.tags];
      currentRating = d.image.rating ?? 0;
      lastUpdatedAt = d.image.updatedAt ?? 0;
      dirty = false;
    } else if (d.mode === "search") {
      image = null;
      currentTags = [];
      currentRating = 0;
      dirty = false;
    }
    allTags = d.allTags ?? [];
  });

  // ─── Save ─────────────────────────────────────────────────────────────
  async function saveChanges() {
    if (!image || !dirty || saving) return;
    saving = true;
    try {
      const res = await api.patch<ImageWithId>(`/api/images/${image.id}`, {
        tags: currentTags,
        rating: currentRating,
        expectedUpdatedAt: lastUpdatedAt,
      });
      if (!res.ok) {
        if (res.status === 409) {
          addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
          await reloadImage();
        } else {
          addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
        }
        return;
      }
      if (res.data) {
        image = res.data;
        currentTags = [...res.data.tags];
        currentRating = res.data.rating;
        lastUpdatedAt = res.data.updatedAt;
      }
      dirty = false;
      addToast("已儲存", "success");
    } finally {
      saving = false;
    }
  }

  const debouncedSave = debounce(saveChanges, 800);

  // Auto-save when dirty changes
  $effect(() => {
    if (dirty) {
      debouncedSave();
    }
  });

  // ─── Reload ───────────────────────────────────────────────────────────
  async function reloadImage() {
    if (!image) return;
    const res = await api.get<ImageWithId>(`/api/images/${image.id}`);
    if (res.ok && res.data) {
      image = res.data;
      currentTags = [...res.data.tags];
      currentRating = res.data.rating;
      lastUpdatedAt = res.data.updatedAt;
      dirty = false;
    }
  }

  // ─── Trash ────────────────────────────────────────────────────────────
  async function trashImage() {
    if (!image) return;
    const ok = await confirmDialog(`確定要將此圖片移入垃圾桶嗎？`);
    if (!ok) return;

    const res = await api.del(`/api/images/${image.id}`);
    if (!res.ok) {
      addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
      return;
    }
    addToast("已移入垃圾桶", "success");
    goto("/editor");
  }

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        saveChanges();
      }
      return;
    }

    if (inInput || e.altKey) return;

    if (e.key === "Escape") {
      e.preventDefault();
      goBack();
    }
  }
</script>

<svelte:head>
  <title>Editor — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- ─── Header ─────────────────────────────────────────────────────────── -->
<header class="editor-header">
  <button class="btn btn-ghost btn-sm" onclick={goBack}>
    <IconArrowLeft size={16} />
    {isEditMode ? "返回搜尋" : "首頁"}
  </button>
  <span class="editor-title">
    {#if isEditMode && image}
      {image.originalName || image.id}
    {:else}
      搜尋圖片
    {/if}
  </span>
  <div class="editor-header-actions">
    {#if isEditMode}
      <button class="btn btn-primary btn-sm" onclick={saveChanges} disabled={!dirty || saving}>
        <IconDeviceFloppy size={16} />
        {saving ? "儲存中..." : "儲存"}
      </button>
      <button class="btn btn-destructive btn-sm" onclick={trashImage}>
        <IconTrash size={16} />
        移入垃圾桶
      </button>
    {/if}
  </div>
</header>

<!-- ─── Content ────────────────────────────────────────────────────────── -->
{#if isEditMode && image}
  <main class="editor-content">
    <EditorPreview currentFilename={previewFilename} {previewSrc} />
    <EditorInfoPanel {image} {allTags} bind:currentTags bind:currentRating bind:dirty />
  </main>
{:else}
  <main class="editor-content-search">
    <EditorSearch
      initialItems={(() => {
        const d = data as any;
        return d.mode === "search" && d.recent ? d.recent.items : [];
      })()}
      {allTags}
      onselect={selectImage}
    />
  </main>
{/if}

{#if confirmModal}
  <ConfirmModal message={confirmModal.message} onconfirm={handleConfirm} oncancel={handleCancel} />
{/if}

<style>
  .editor-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    z-index: 100;
  }

  .editor-title {
    font-size: 0.875rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .editor-header-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
    flex-shrink: 0;
  }

  .editor-content {
    display: flex;
    height: calc(100vh - 3rem);
    margin-top: 3rem;
  }

  .editor-content-search {
    margin-top: 3rem;
    min-height: calc(100vh - 3rem);
  }

  @media (max-width: 768px) {
    .editor-content {
      flex-direction: column;
    }
  }
</style>
