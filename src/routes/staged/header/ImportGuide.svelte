<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { IconDatabase } from "$lib/icons";
  import { getImportContext } from "../logic/import.svelte";

  const importer = getImportContext();

  let fileInput = $state<HTMLInputElement>();

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    importer.handleImportFile(input.files[0]);
    input.value = "";
  };
</script>

<p>選擇一個 JSON 檔案，內容為「檔名 → 紀錄」的物件，例如：</p>

<pre>{'{\n  "photo-001.jpg": {\n    "name": "夕陽",\n    "tags": ["風景", "夕陽"],\n    "rating": 4\n  }\n}'}</pre>

<ul>
  <li>key 必須對應 <code>images/</code> 資料夾中的實際檔名</li>
  <li><code>tags</code> 為必填的非空字串陣列（每個 ≤ 50 字元、不含逗號）</li>
  <li><code>name</code> 必填（≤ 200 字元）；<code>rating</code> 可選（0–5 的整數）</li>
  <li>不存在的圖片將被跳過；已存在的紀錄將被覆寫</li>
  <li>系統會自動計算圖片的寬高與模糊預覽</li>
</ul>

<div>
  <Button variant="outlined" onclick={importer.handleClose}>取消</Button>
  <Button variant="primary" onclick={() => fileInput?.click()}>
    <IconDatabase size={16} />
    <span>選擇 JSON 檔案</span>
  </Button>
  <input bind:this={fileInput} type="file" accept=".json" class="sr-only" onchange={handleFileChange} />
</div>

<style>
  p {
    font: var(--font-body2);
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  pre {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    line-height: 1.5;
    color: var(--color-text-muted);
    background: var(--color-bg);
    border: var(--border-style);
    border-radius: var(--border-radius);
    padding: 0.625rem 0.75rem;
    overflow-x: auto;
    margin-bottom: 0.75rem;
  }

  ul {
    font: var(--font-body2);
    color: var(--color-text-muted);
    padding-left: 1.25rem;
    margin-bottom: 1.25rem;

    & > li {
      margin-bottom: 0.25rem;
    }

    & code {
      font-family: var(--font-family-mono);
      font-size: 0.9em;
      color: var(--color-text);
    }
  }

  div {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
