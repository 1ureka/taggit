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
  aria-label="查詢使用這些標籤的圖片"
  {@attach tooltip({ content: "查詢使用這些標籤的圖片" })}
>
  <IconExternalLink size={16} />
</ButtonLink>
