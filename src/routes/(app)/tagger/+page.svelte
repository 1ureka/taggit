<script lang="ts">
  import { addToast } from "$lib/components/floating/toast-events";
  import Button from "$lib/components/actions/Button.svelte";
  import ReviewModal, { type ReviewEntry } from "./review/ReviewModal.svelte";
  import MarkupText from "$lib/components/display/MarkupText.svelte";

  // Phase 3 起點：目前只搬了 ReviewModal（規格參考 taggit tagger-b/modals/ReviewModal.svelte），
  // 這頁先用假資料當測試場，之後 list/StagedGrid、inspector/StampTool、logic/draft.ts 陸續補齊時，
  // 下面的假資料與 stub 行為要換成真的暫存清單與 api/proto/staged-batch。

  const existingTagNames = ["golden-hour", "landscape", "portrait", "studio", "night", "long-exposure", "macro"];

  let entries = $state<ReviewEntry[]>([
    {
      filename: "sunset-01.jpg",
      imgSrc: "https://picsum.photos/seed/taggit-tagger-1/400",
      name: "夕陽 01",
      rating: 4,
      tags: ["golden-hour", "landscape"],
      problem: null,
    },
    {
      filename: "sunset-02.jpg",
      imgSrc: "https://picsum.photos/seed/taggit-tagger-2/400",
      name: "夕陽 02",
      rating: 0,
      tags: [],
      problem: "尚未加入任何標籤",
    },
    {
      filename: "portrait-03.jpg",
      imgSrc: "https://picsum.photos/seed/taggit-tagger-3/400",
      name: "肖像 03",
      rating: 5,
      tags: ["portrait", "studio", "new-idea"],
      problem: null,
    },
    {
      filename: "sunset-02-Lorem-ipsum-dolor-sit-amet-dolor-sit-amet-dolor-sit-amet-dolor-sit-amet.jpg",
      imgSrc: "https://picsum.photos/seed/taggit-tagger-4/400",
      name: "夕陽 01",
      rating: 3,
      tags: ["macro", "long-exposure"],
      problem: null,
    },
    {
      filename: "night-05.jpg",
      imgSrc: "https://picsum.photos/seed/taggit-tagger-5/400",
      name: "夜景 05",
      rating: 2,
      tags: ["night", "long-exposure", "cityscape"],
      problem: null,
    },
  ]);

  let reviewOpen = $state(false);

  // 示意伺服器端失敗：night-05.jpg 第一次提交必定失敗一次，用來測試失敗後重試的流程
  const failedOnce = new Set<string>();

  async function fakeSubmit(filenames: string[]): Promise<Map<string, string>> {
    await new Promise((r) => setTimeout(r, 600));
    const fails = new Map<string, string>();
    for (const f of filenames) {
      if (f === "night-05.jpg" && !failedOnce.has(f)) {
        failedOnce.add(f);
        fails.set(f, "伺服器錯誤，請稍後再試");
      }
    }
    entries = entries.filter((e) => !filenames.includes(e.filename) || fails.has(e.filename));
    return fails;
  }

  function handleEdit(filename: string) {
    reviewOpen = false;
    addToast({ message: `（示意）繼續編輯 ${filename}`, variant: "info" });
  }

  function handlePreview(filename: string) {
    addToast({ message: `（示意）預覽 ${filename}`, variant: "info" });
  }

  const description =
    "Phase 3 起點，目前只搬了 `ReviewModal`，下面用假資料測試互動。`sunset-02.jpg` 沒有標籤，帶有 problem 永遠無法勾選（標籤不能為空）；`night-05.jpg` 第一次提交會故意失敗一次（伺服器錯誤），可以測試失敗後重試的流程；其餘項目送出即成功並離開清單。";
</script>

<svelte:head>
  <title>Tagger</title>
</svelte:head>

<div class="page">
  <header>
    <h1>Tagger</h1>
    <MarkupText markup={description} />
    <Button variant="primary" onclick={() => (reviewOpen = true)}>檢視待提交的變更（{entries.length}）</Button>
  </header>

  <ul class="staged">
    {#each entries as entry (entry.filename)}
      <li>{entry.name}（{entry.filename}）</li>
    {:else}
      <li class="empty">全部已提交完畢</li>
    {/each}
  </ul>
</div>

<ReviewModal
  open={reviewOpen}
  {entries}
  {existingTagNames}
  onclose={() => (reviewOpen = false)}
  submit={fakeSubmit}
  onedit={handleEdit}
  onpreview={handlePreview}
/>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 40rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  h1 {
    font: var(--font-title1);
  }

  .staged {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    list-style: none;
  }

  .staged > li {
    padding: 0.5rem 0.75rem;
    border: var(--border-style);
    border-radius: var(--border-radius);
    font: var(--font-body2);
  }

  .staged > li.empty {
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
