<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconX } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 目前正在編輯的檔案的檔案名稱 */
    activeFile: string;
    /** 目前正在編輯的檔案的指標 */
    activeIndex: number;
    /** 暫存檔案的總數量 */
    fileCount: number;
    /** 點擊關閉面板按紐 */
    onclose: () => void;
  };

  let { activeFile, activeIndex, fileCount, onclose }: Props = $props();
</script>

<header>
  <h3 class="ellipsis" title={activeFile}>{activeFile}</h3>
  <Chip variant="outlined" style="font: var(--font-caption);">{`${activeIndex} / ${fileCount}`}</Chip>
  <Button
    variant="ghost"
    padding="icon"
    aria-label="關閉表單"
    onclick={onclose}
    {@attach tooltip({ content: "關閉表單" })}
  >
    <IconX size={16} />
  </Button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    min-height: 2.5rem;
    border-bottom: var(--border-style);
  }

  h3 {
    flex: 1;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
