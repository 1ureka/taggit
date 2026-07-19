<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { isTouched, problemOf } from "../logic/draft";
  import { getEditorContext } from "../logic/editor.svelte";
  import CardInfo from "./CardInfo.svelte";

  let { filename }: { filename: string } = $props();

  const editor = getEditorContext();

  const draft = $derived(editor.draftOf(filename));
  const touched = $derived(isTouched(draft));
  const problem = $derived(problemOf(draft));
  const active = $derived(editor.isActive(filename));
</script>

<button type="button" class:active onclick={() => editor.handleSelect(filename)}>
  <img src={imgSrc(filename, "sm")} alt={filename} loading="lazy" />
  <CardInfo {filename} {touched} {problem} name={draft.name} rating={draft.rating} tagCount={draft.tags.length} />
</button>

<style>
  button {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    overflow: hidden;
    text-align: left;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.98);
    }
  }

  img {
    display: block;
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
    background: var(--color-bg);
    transition: border-radius 0.15s ease;
  }

  button {
    background-color: transparent;
    border-color: transparent;

    & img {
      border-radius: var(--border-radius);
    }
  }

  button:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-border-hover);

    & img {
      border-radius: 0px;
    }
  }

  button.active {
    background-color: hsl(from var(--color-accent) h s l / 0.15);
    border-color: hsl(from var(--color-accent) h s l / 0.35);

    & img {
      border-radius: 0px;
    }
  }
</style>
