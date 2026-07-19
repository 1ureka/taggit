<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconMaximize } from "$lib/icons";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  import { getEditorContext } from "../logic/editor.svelte";
  import { getLightboxContext } from "../logic/lightbox.svelte";
  import InspectorHeader from "./InspectorHeader.svelte";
  import InspectorFields from "./InspectorFields.svelte";
  import InspectorFooter from "./InspectorFooter.svelte";

  const editor = getEditorContext();
  const lightbox = getLightboxContext();

  const file = $derived(editor.activeFile);
  const draft = $derived(editor.activeDraft);
</script>

{#if file !== null && draft}
  <aside>
    <InspectorHeader />

    <div class="preview">
      <ImageCanvas resetKey={file} style="height: 220px; min-height: 220px; border-bottom: var(--border-style);">
        <img src={imgSrc(file, "sm")} alt={file} draggable="false" />
      </ImageCanvas>
      <Button
        variant="outlined"
        padding="icon"
        aria-label="全螢幕預覽"
        onclick={() => lightbox.handleOpen()}
        {@attach tooltip({ content: "全螢幕預覽" })}
        style="position: absolute; right: 0.5rem; bottom: 0.5rem;"
      >
        <IconMaximize size={16} />
      </Button>
    </div>

    <div class="fields">
      <InspectorFields />
      <InspectorFooter />
    </div>
  </aside>
{/if}

<style>
  aside {
    display: flex;
    flex-direction: column;
    width: 22rem;
    min-width: 22rem;
    min-height: 0;
    border-left: var(--border-style);
  }

  div.preview {
    position: relative;
    flex-shrink: 0;
  }

  div.fields {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
