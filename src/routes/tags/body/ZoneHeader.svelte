<script lang="ts">
  import type { Tag } from "$lib/database";
  import { ImageWhere } from "$lib/query-spec";
  import { IconExternalLink, IconTagPlus, IconX } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";

  import { getZonesContext, type ZoneTarget } from "../logic/zones.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  let { target, tags, label }: { target: ZoneTarget; tags: Tag[]; label: string } = $props();

  const zones = getZonesContext();
  const selection = getSelectionContext();

  const href = $derived(`/?${new ImageWhere({ includedTags: tags.map((t) => t.name) }).toSearchParams()}`);

  const onadd = () => zones.handleAssign(target, selection.consume());
  const ondissolve = () => zones.handleDissolve(target);
</script>

<div>
  <div style="flex: 1">
    <p><b>{label}</b></p>

    <ButtonLink
      variant="ghost"
      padding="icon"
      {href}
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
    status={selection.size === 0 ? "disabled" : undefined}
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
