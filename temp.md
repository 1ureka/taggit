```
<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";

  const addedTags = ["forest", "wildlife"];
  const removedTags = ["city", "indoor"];

  const chipColorToken = "var(--chip-color)";
  const chipStyle = `color: ${chipColorToken}; border-color: hsl(from ${chipColorToken} h s l / 0.5); background: hsl(from ${chipColorToken} h s l / 0.08);`;

  const chipStyles = {
    plus: "--chip-color: var(--color-success); " + chipStyle,
    minus: "--chip-color: var(--color-error); " + chipStyle,
  };
</script>

<svelte:head>
  <title>Chip</title>
</svelte:head>

<div>
  {#each addedTags as tag}
    <Chip style={chipStyles.plus}>
      <span class="sign">+</span>{tag}
    </Chip>
  {/each}
  {#each removedTags as tag}
    <Chip style={chipStyles.minus}>
      <span class="sign">−</span>{tag}
    </Chip>
  {/each}
</div>

<style>
  div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .sign {
    font-family: var(--font-family-mono);
  }
</style>
```

(若單種類變化過多，比如 addedTags 過多，則第 6 個 addedTag 畢竟是 "+ N")
