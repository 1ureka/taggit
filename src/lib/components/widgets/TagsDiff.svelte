<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 標籤清單 */
    tags: string[];
    /** 新增或移除 */
    sign: "+" | "-";
    /** 超過這個數量收斂成一個 +N/-N 溢出標籤 */
    max?: number;
  };

  let { tags, sign, max = 3 }: Props = $props();

  const colorVar = $derived(sign === "+" ? "var(--color-success)" : "var(--color-error)");

  const chipStyle = $derived(
    [
      `color: ${colorVar}`,
      `border-color: hsl(from ${colorVar} h s l / 0.5)`,
      `background: hsl(from ${colorVar} h s l / 0.08)`,
      "font: var(--font-caption)",
      "max-width: 8rem",
    ].join(";"),
  );

  const shown = $derived(tags.slice(0, max));
  const overflow = $derived(tags.length - shown.length);
</script>

{#each shown as tag (tag)}
  <Chip style={chipStyle}>
    <span class="sign">{sign}</span>
    <span class="ellipsis">{tag}</span>
  </Chip>
{/each}
{#if overflow > 0}
  <Chip style={chipStyle}>
    <span class="sign">{sign + overflow}</span>
  </Chip>
{/if}

<style>
  .sign {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }
</style>
