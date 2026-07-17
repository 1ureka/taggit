<script lang="ts">
  import { ImageWhere } from "$lib/query-spec";
  import { IconExternalLink } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";

  let { names, disabled }: { names: string[]; disabled?: boolean } = $props();
</script>

<ButtonLink
  variant="ghost"
  padding="icon"
  href={`/?${new ImageWhere({ includedTags: names }).toSearchParams()}`}
  status={disabled ? "disabled" : undefined}
  target="_blank"
  rel="noopener"
  aria-label="以這些標籤查詢圖片（新分頁）"
  {@attach tooltip({ content: "以這些標籤查詢圖片（新分頁）" })}
>
  <IconExternalLink size={14} />
</ButtonLink>
