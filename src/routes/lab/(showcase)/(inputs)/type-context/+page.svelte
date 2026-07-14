<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Menu from "$lib/components/floating/Menu.svelte";
  import { crossfade, fly } from "svelte/transition";
  import { IconEye, IconEyeOff, IconSearch } from "$lib/icons";
  import { IconPlus, IconAdjustmentsSpark, IconChevronDown } from "$lib/icons";
  import { IconImage, IconCode, IconBook, IconCheck } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  const id = $props.id();

  // ---

  let searchExpanded = $state(false);
  let searchValue = $state("");
  let searchInputRef = $state<HTMLInputElement>();
  let searchContainerRef = $state<HTMLDivElement>();

  $effect(() => {
    if (searchExpanded && searchInputRef) {
      searchInputRef.focus();
    }
  });

  const handleClickOutside = (event: MouseEvent) => {
    if (!searchContainerRef) return;

    if (searchValue) return;

    const target = event.target;
    if (!target || !(target instanceof Node)) return;

    if (searchExpanded && !searchContainerRef.contains(target)) {
      searchExpanded = false;
    }
  };

  const [send, receive] = crossfade({
    duration: (len) => {
      return Math.min(800, Math.sqrt(len) * 200);
    },
    fallback(node) {
      return fly(node, { y: 16, duration: 200, opacity: 0 });
    },
  });

  // ---

  let passwordValue = $state("");
  let passwordVisible = $state(false);
  let passwordValueChanged = $state(false);
  let passwordBlurred = $state(false);

  const passwordTouched = $derived.by(() => passwordValueChanged && passwordBlurred);

  const errorMessage = $derived.by(() => {
    if (!passwordTouched) return "";
    if (passwordValue.length < 8) return "Password must be at least 8 characters long";
    return "";
  });

  // ---

  type Plugin = { key: string; label: string; Icon: typeof IconSearch };
  const plugins: Plugin[] = [
    { key: "web-search", label: "Web search", Icon: IconSearch },
    { key: "image-gen", label: "Image generation", Icon: IconImage },
    { key: "code-interpreter", label: "Code interpreter", Icon: IconCode },
    { key: "knowledge-base", label: "Knowledge base", Icon: IconBook },
  ];

  let enabledPlugins = $state<Record<string, boolean>>({ "web-search": true });
  const togglePlugin = (key: string) => () => {
    enabledPlugins = { ...enabledPlugins, [key]: !enabledPlugins[key] };
  };

  let pluginsAnchor = $state<HTMLElement>();
  let pluginsOpen = $state(false);

  // ---

  type Model = { key: string; label: string; description: string };
  const models: Model[] = [
    { key: "flash", label: "Flash", description: "Fast and efficient for everyday tasks" },
    { key: "pro", label: "Pro", description: "Balanced reasoning for most workflows" },
    { key: "ultra", label: "Ultra", description: "Most capable model for demanding tasks" },
  ];

  let selectedModelKey = $state("flash");
  const selectedModel = $derived(models.find((m) => m.key === selectedModelKey) ?? models[0]);

  let modelAnchor = $state<HTMLElement>();
  let modelOpen = $state(false);
  const selectModel = (key: string) => () => {
    selectedModelKey = key;
    modelOpen = false;
  };
</script>

<svelte:head>
  <title>Text field — In context</title>
</svelte:head>

<svelte:window onclick={handleClickOutside} />

<!-- --- -->

{#snippet searchDemo()}
  <div class="search-container" bind:this={searchContainerRef}>
    {#if !searchExpanded}
      <div class="search-button" in:receive={{ key: "search-input" }} out:send={{ key: "search-input" }}>
        <Button variant="outlined" onclick={() => (searchExpanded = true)}>
          <span out:fly={{ y: 0, duration: 10 }} in:fly={{ y: 0, duration: 150, delay: 100 }}>
            <IconSearch size={18} />
          </span>
          <span class="sr-only">Activate search</span>
        </Button>
      </div>
    {:else}
      <div class="search-input" in:receive={{ key: "search-input" }} out:send={{ key: "search-input" }}>
        <TextInput
          bind:input={searchInputRef}
          bind:value={searchValue}
          variant="outlined"
          label="Search"
          labelHidden
          placeholder="Search for anything..."
        >
          {#snippet adornmentLeft()}
            <span style="display: flex; align-items: center; padding-left: 0.75rem;">
              <IconSearch size={18} />
            </span>
          {/snippet}
        </TextInput>
      </div>
    {/if}
  </div>
{/snippet}

<!-- --- -->

{#snippet passwordDemo()}
  <div class="password-input">
    <TextInput
      bind:value={passwordValue}
      type={passwordVisible ? "text" : "password"}
      label="Password"
      placeholder="Enter your password"
      status={errorMessage ? "error" : undefined}
      aria-describedby={errorMessage ? `password-error-${id}` : undefined}
      oninput={() => (passwordValueChanged = true)}
      onblur={() => (passwordBlurred = true)}
    >
      {#snippet adornmentRight()}
        <Button
          variant="ghost"
          padding="icon"
          onclick={() => (passwordVisible = !passwordVisible)}
          style="margin-right: 0.5rem;"
        >
          {#if passwordVisible}
            <IconEyeOff size={18} />
          {:else}
            <IconEye size={18} />
          {/if}
          <span class="sr-only">{passwordVisible ? "Hide password" : "Show password"}</span>
        </Button>
      {/snippet}
    </TextInput>

    {#if errorMessage}
      <span id="password-error-{id}" class="error">{errorMessage}</span>
    {/if}
  </div>
{/snippet}

<!-- --- -->

{#snippet aiDemoPlugins()}
  {#snippet iconRow({ Icon, label, checked }: { Icon: typeof IconSearch; label: string; checked?: boolean })}
    <span class="icon-row">
      <Icon size={16} />
      <span>{label}</span>
      {#if checked}
        <IconCheck size={16} style="margin-left: auto;" />
      {/if}
    </span>
  {/snippet}

  {@const triggerId = `${id}-plugins-trigger`}
  {@const menuId = `${id}-plugins-menu`}
  {@const menuItems = [
    { type: "label", content: "Plugins", props: { style: "min-width: 12rem" } } as const,
    ...plugins.map(
      ({ Icon, label, key }) =>
        ({
          type: "button",
          content: { render: iconRow, props: { Icon, label, checked: !!enabledPlugins[key] } },
          props: { "aria-pressed": !!enabledPlugins[key], onclick: togglePlugin(key) },
        }) as const,
    ),
  ]}

  <span bind:this={pluginsAnchor} class="toolbar-anchor">
    <Button
      id={triggerId}
      variant="ghost"
      padding="icon"
      aria-label="Plugins: Browse and enable"
      aria-expanded={pluginsOpen}
      aria-controls={menuId}
      onclick={() => (pluginsOpen = !pluginsOpen)}
      {@attach tooltip({ content: "Browse and enable plugins" })}
    >
      <IconAdjustmentsSpark size={18} />
      <span>Plugins</span>
    </Button>
  </span>

  <Menu
    id={menuId}
    labelledBy={{ triggerId }}
    open={pluginsOpen}
    reference={pluginsAnchor}
    placement="top-start"
    onclose={() => (pluginsOpen = false)}
    items={menuItems}
  />
{/snippet}

<!-- --- -->

{#snippet aiDemoModel()}
  {#snippet columnRow({ label, description }: { label: string; description: string })}
    <span class="column-row">
      <span class="column-row-label">{label}</span>
      <span class="column-row-description">{description}</span>
    </span>
  {/snippet}

  {@const triggerId = `${id}-model-trigger`}
  {@const menuId = `${id}-model-menu`}
  {@const menuItems = models.map(
    ({ label, description, key }) =>
      ({
        type: "button",
        content: { render: columnRow, props: { label, description } },
        props: {
          "aria-current": selectedModelKey === key ? "true" : undefined,
          "aria-label": `${label}: ${description}`,
          onclick: selectModel(key),
          style: selectedModelKey === key ? "background-color: var(--color-bg-active);" : undefined,
        },
      }) as const,
  )}

  <span bind:this={modelAnchor} class="toolbar-anchor" style="margin-left: auto;">
    <Button
      id={triggerId}
      variant="ghost"
      aria-label="Choose a model"
      aria-expanded={modelOpen}
      aria-controls={menuId}
      onclick={() => (modelOpen = !modelOpen)}
      style="padding: 0.25rem 0.5rem;"
      {@attach tooltip({ content: "Choose a model" })}
    >
      <span>{selectedModel.label}</span>
      <span class={{ chevron: true, expanded: modelOpen }}><IconChevronDown size={18} /></span>
    </Button>
  </span>

  <Menu
    id={menuId}
    labelledBy={{ triggerId }}
    open={modelOpen}
    reference={modelAnchor}
    placement="top-end"
    onclose={() => (modelOpen = false)}
    items={menuItems}
  />
{/snippet}

<!-- --- -->

{#snippet aiDemo()}
  <div class="ai-input">
    <TextInput
      multiline
      variant="filled"
      label="Enter your prompt"
      labelHidden
      aria-describedby={`ai-helper-${id}`}
      placeholder="Ask me anything..."
      disableActiveFeedback
    >
      {#snippet adornmentBottom()}
        <div class="toolbar">
          <Button variant="ghost" padding="icon" {@attach tooltip({ content: "Attach files" })}>
            <IconPlus size={18} />
            <span class="sr-only">Attach files</span>
          </Button>

          {@render aiDemoPlugins()}
          {@render aiDemoModel()}
        </div>
      {/snippet}
    </TextInput>

    <span id="ai-helper-{id}">AI can hallucinate and provide incorrect facts.</span>
  </div>
{/snippet}

<!-- --- -->

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      {@render searchDemo()}
      {@render passwordDemo()}
      {@render aiDemo()}
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Text field"
  label="In context"
  guide="Every context asks something different of the same field."
  {preview}
/>

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    width: 100%;
  }

  .search-container {
    position: relative;
    display: flex;
    align-items: center;
    height: 2.5rem;
  }

  .search-button {
    position: absolute;
    left: 0;
  }

  .search-input {
    width: 100%;
    display: grid;
    place-items: stretch;
  }

  .password-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & > .error {
      font: var(--font-caption);
      color: var(--color-error);
    }
  }

  /* --- */

  .ai-input {
    grid-column: span 2;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & > span {
      font: var(--font-caption);
      color: var(--color-text-muted);
    }
  }

  .toolbar {
    display: flex;
    gap: 0.25rem;
    padding: 0 0.5rem;
    padding-bottom: 0.5rem;
  }

  .toolbar-anchor {
    display: inline-flex;
  }

  .chevron {
    transition: transform 0.2s ease;
    will-change: transform;
    &.expanded {
      transform: rotate(180deg);
    }
  }

  .icon-row {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .column-row {
    display: inline-flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;
    text-align: left;
    border-radius: inherit;
  }

  .column-row-label {
    font: var(--font-body2);
    color: var(--color-text);
  }

  .column-row-description {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }
</style>
