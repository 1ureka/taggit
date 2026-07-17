<script lang="ts">
  import { ImageWhere } from "$lib/query-spec";
  import { IconExternalLink, IconTagPlus, IconX } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";

  type Props = {
    /** 目前選取中的標籤數量 */
    selected: number;
    /** 該組的名稱 */
    label: string;
    /** 該組的所有標籤 */
    tags: string[];
    /** 加入事件 */
    onadd: () => void;
    /** 解散事件 */
    ondissolve: () => void;
  };

  let { selected, label, tags, onadd, ondissolve }: Props = $props();
</script>

<div>
  <div style="flex: 1">
    <p><b>{label}</b></p>

    <ButtonLink
      variant="ghost"
      padding="icon"
      href={`/?${new ImageWhere({ includedTags: tags }).toSearchParams()}`}
      status={tags.length < 1 ? "disabled" : undefined}
      target="_blank"
      rel="noopener"
      aria-label="查詢使用這些標籤的圖片"
      {@attach tooltip({ content: "查詢使用這些標籤的圖片" })}
    >
      <IconExternalLink size={16} />
    </ButtonLink>
  </div>

  <Button
    variant="ghost"
    padding="icon"
    aria-label="加入選取中的標籤"
    onclick={onadd}
    status={selected === 0 ? "disabled" : undefined}
    {@attach tooltip({ content: "加入選取中的標籤", placement: "left" })}
  >
    <IconTagPlus size={16} />
  </Button>

  <Button
    variant="ghost"
    padding="icon"
    aria-label="清空這組的標籤"
    onclick={ondissolve}
    {@attach tooltip({ content: "清空標籤" })}
  >
    <IconX size={16} />
  </Button>
</div>

<style>
  p {
    transform: translateY(1.5px);
  }

  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    align-self: stretch;
  }
</style>
