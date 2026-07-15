<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconX } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 目前正在編輯的檔案的檔案名稱 */
    file: string;
    /** 目前正在編輯的檔案的指標 */
    current: number;
    /** 暫存檔案的總數量 */
    total: number;
    /** 點擊關閉面板按紐 */
    onclose: () => void;
  };

  let { file, current, total, onclose }: Props = $props();
</script>

<header>
  <h3 class="ellipsis" title={file}>{file}</h3>
  <Chip variant="outlined" style="font: var(--font-caption);">{`${current} / ${total}`}</Chip>
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
