<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonConfirm from "$lib/components/actions/ButtonConfirm.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import Menu from "$lib/components/floating/Menu.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconChevronDown, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerStopFilled } from "$lib/icons";
  import { IconDownload, IconPuzzleFilled } from "$lib/icons";

  const componentId = $props.id();

  let pending = $state<Record<string, boolean>>({});
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  $effect(() => {
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  });

  const handleClick = (key: string) => () => {
    pending = { ...pending, [key]: true };
    if (timers.has(key)) clearTimeout(timers.get(key));
    const timer = setTimeout(() => {
      pending = { ...pending, [key]: false };
    }, 1000);
    timers.set(key, timer);
  };

  const statusOf = (key: string) => (pending[key] ? "pending" : undefined);

  // ---

  const radiusMap = {
    horizontal: [
      "border-top-right-radius: 0; border-bottom-right-radius: 0;",
      "border-radius: 0;",
      "border-top-left-radius: 0; border-bottom-left-radius: 0;",
    ],
    vertical: [
      "border-bottom-left-radius: 0; border-bottom-right-radius: 0;",
      "border-radius: 0;",
      "border-top-left-radius: 0; border-top-right-radius: 0;",
    ],
  } as const;

  const primaryBorderColor = "hsl(from var(--color-bg) h s l / 0.3)";

  const primaryMap = {
    horizontal: [`border-right-color: ${primaryBorderColor};`, `border-right-color: ${primaryBorderColor};`, ""],
    vertical: [`border-bottom-color: ${primaryBorderColor};`, `border-bottom-color: ${primaryBorderColor};`, ""],
  } as const;

  const outlinedMap = {
    horizontal: ["border-right: none;", "border-right: none;", ""],
    vertical: ["border-bottom: none;", "border-bottom: none;", ""],
  } as const;

  const ghostMap = {
    horizontal: ["border-right: var(--border-style);", "border-right: var(--border-style);", ""],
    vertical: ["border-bottom: var(--border-style);", "border-bottom: var(--border-style);", ""],
  } as const;

  // ---

  const groupTotalButtons = 3;
  const splitTotalButtons = 2;

  const getOutlinedStyle = (index: number, orientation: "horizontal" | "vertical" = "horizontal") => {
    const type = index === 0 ? 0 : index === groupTotalButtons - 1 ? 2 : 1;
    return radiusMap[orientation][type] + outlinedMap[orientation][type];
  };

  const getGhostStyle = (index: number, orientation: "horizontal" | "vertical" = "horizontal") => {
    const type = index === 0 ? 0 : index === groupTotalButtons - 1 ? 2 : 1;
    return radiusMap[orientation][type] + ghostMap[orientation][type];
  };

  const getSplitButtonStyle = (index: number, orientation: "horizontal" | "vertical" = "horizontal") => {
    const type = index === 0 ? 0 : index === splitTotalButtons - 1 ? 2 : 1;
    return primaryMap[orientation][type] + radiusMap[orientation][type];
  };

  // ---

  const group1 = [
    { label: "Share", key: "share" },
    { label: "Export", key: "export" },
    { label: "Print", key: "print" },
  ];

  const group2 = [
    { label: "Start", key: "start", Icon: IconPlayerPlayFilled },
    { label: "Pause", key: "pause", Icon: IconPlayerPauseFilled },
    { label: "Terminate", key: "terminate", Icon: IconPlayerStopFilled, confirm: true },
  ];

  let anchor = $state<HTMLElement>();
  let open = $state(false);

  const handleSplitButtonAction = () => {
    open = false;
    handleClick("split")();
  };
</script>

<svelte:head>
  <title>Button — Compositions</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Horizontal</h4>

        <div class="group-container" style="align-self: center;">
          {#each group1 as { label, key }, index (key)}
            {@const props = { status: statusOf(key), style: getGhostStyle(index) } as const}
            <Button variant="ghost" onclick={handleClick(key)} {...props}>
              {label}
            </Button>
          {/each}
        </div>

        <div class="group-container">
          {#each group2 as item, index (item.key)}
            {@const { label, Icon, confirm } = item}
            {@const key = item.key + "H"}
            {@const props = { status: statusOf(key), style: getOutlinedStyle(index) } as const}

            {#if confirm}
              <ButtonConfirm variant="destructive" onconfirm={handleClick(key)} {...props}>
                <Icon size={16} />
                <span style="flex: 1;">{label}</span>
              </ButtonConfirm>
            {:else}
              <Button variant="outlined" onclick={handleClick(key)} {...props}>
                <Icon size={16} />
                <span style="flex: 1;">{label}</span>
              </Button>
            {/if}
          {/each}
        </div>
      </section>

      <div>
        <section>
          <h4>Vertical</h4>
          <div class="group-container vertical">
            {#each group2 as item, index (item.key)}
              {@const { label, Icon, confirm } = item}
              {@const key = item.key + "V"}
              {@const handler = confirm ? { onconfirm: handleClick(key) } : { onclick: handleClick(key) }}
              {@const props = { status: statusOf(key), style: getOutlinedStyle(index, "vertical"), ...handler } as const}

              {#if confirm}
                <ButtonConfirm variant="destructive" {...props} {@attach tooltip({ content: label, placement: "left" })}>
                  <Icon size={16} />
                  <span class="sr-only">{label}</span>
                </ButtonConfirm>
              {:else}
                <Button variant="outlined" {...props} {@attach tooltip({ content: label, placement: "left" })}>
                  <Icon size={16} />
                  <span class="sr-only">{label}</span>
                </Button>
              {/if}
            {/each}
          </div>
        </section>

        <section>
          <h4>Split</h4>
          <div bind:this={anchor} class="split-button-container">
            <Button
              variant="primary"
              status={statusOf("split")}
              onclick={handleSplitButtonAction}
              style={getSplitButtonStyle(0)}
            >
              <IconDownload size={16} />
              Download as PDF
            </Button>
            <Button
              id={`${componentId}-split-button`}
              variant="primary"
              padding="icon"
              status={pending["split"] ? "disabled" : undefined}
              style={getSplitButtonStyle(1)}
              onclick={() => (open = !open)}
              aria-expanded={open}
              aria-controls={`${componentId}-split-button-menu`}
            >
              <span class={{ chevron: true, expanded: open }}><IconChevronDown size={14} /></span>
              <span class="sr-only">Toggle menu</span>
            </Button>
          </div>

          <Menu
            id={`${componentId}-split-button-menu`}
            labelledBy={{ triggerId: `${componentId}-split-button` }}
            {open}
            matchWidth
            reference={anchor}
            onclose={() => (open = false)}
            items={[
              {
                type: "button",
                content: "Export to .docx",
                props: { style: "min-width: 10rem;", onclick: handleSplitButtonAction },
              },
              {
                type: "button",
                content: "Export to .md",
                props: { style: "min-width: 10rem;", onclick: handleSplitButtonAction },
              },
              {
                type: "separator",
              },
              {
                type: "button",
                content: "Copy Shareable Link",
                props: { style: "min-width: 10rem;", onclick: handleSplitButtonAction },
              },
            ]}
          />
        </section>
      </div>

      <section style="width: 90%;">
        <h4>Complex</h4>

        <ButtonLink variant="outlined" href="#" style="display: grid; grid-template-columns: auto 1fr;">
          <span style="align-self: flex-start; margin-right: 0.25rem;">
            <IconPuzzleFilled size={24} />
          </span>
          <div class="complex-layout">
            <h4>Creative Tooling</h4>
            <p>Plugins and productivity tools.</p>
          </div>
        </ButtonLink>
      </section>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Button"
  label="Compositions"
  guide="In the wild, buttons take on diverse forms to blend into their surroundings."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: min(25rem, 100%);
  }

  /* --- */

  div:has(> section > .group-container.vertical) {
    display: flex;
    flex-wrap: wrap;
    gap: 4.5rem;
  }

  section {
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    gap: 0.5rem;
  }

  section > h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);
  }

  /* --- */

  .group-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);

    &.vertical {
      grid-template-columns: 1fr;
    }
  }

  .split-button-container {
    display: inline-flex;
    align-items: stretch;
  }

  .complex-layout {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    white-space: pre-wrap;

    & > h4 {
      font: var(--font-body1);
      color: var(--color-text);
    }

    & > p {
      font: var(--font-body2);
      color: var(--color-text-muted);
    }
  }

  /* --- */

  .chevron {
    will-change: transform;
    transition: transform 0.15s ease;

    &.expanded {
      transform: rotate(180deg);
    }
  }
</style>
