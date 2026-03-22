<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { formatDate, formatSize } from "$lib/utils.js";

  type Props = { image: ImageWithId };
  let { image }: Props = $props();
</script>

<dl>
  <dt>檔案名稱</dt>
  <dd class="mono">{image.id}</dd>

  <dt>提交時間</dt>
  <dd>{image.committedAt ? formatDate(image.committedAt) : "—"}</dd>

  <dt>檔案大小</dt>
  <dd>{image.fileSize ? formatSize(image.fileSize) : "—"}</dd>

  {#if image.width && image.height}
    <dt>解析度</dt>
    <dd>{image.width} × {image.height}</dd>
  {/if}
</dl>

<style>
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    font-size: 0.75rem;
    margin: 0;
  }

  dt {
    color: var(--text-dim);
    white-space: nowrap;
  }

  dd {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd.mono {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }
</style>
