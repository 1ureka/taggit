<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Menu from "$lib/components/floating/Menu.svelte";
  import { IconChevronDown, IconGithub, IconBrush, IconLink, IconCheck } from "$lib/icons";
  import { IconCategoryFilled, IconUserFilled } from "$lib/icons";

  let simpleMenuOpen = $state(false);
  let simpleMenuAnchor = $state<HTMLElement>();

  let profileMenuOpen = $state(false);
  let profileMenuAnchor = $state<HTMLElement>();

  let theme = $state<"light" | "dark" | "system">("system");

  const minWidthStyle = "min-width: 10rem";

  const simpleMenuItems = [
    { type: "label", content: "Workspace", props: { style: minWidthStyle } },
    { type: "link", content: "Open dashboard", props: { href: "#" } },
    { type: "link", content: "View activity", props: { href: "#" } },
    {
      type: "submenu",
      key: "create",
      content: "Create new",
      items: [
        { type: "button", content: "Document", props: { style: minWidthStyle } },
        { type: "button", content: "Spreadsheet", props: { disabled: true } },
        {
          type: "submenu",
          key: "from-template",
          content: "From template",
          items: [
            { type: "link", content: "Meeting notes", props: { href: "#", style: minWidthStyle } },
            { type: "link", content: "Project brief", props: { href: "#" } },
            { type: "link", content: "Weekly report", props: { href: "#" } },
          ],
        },
      ],
    },
    { type: "separator" },
    {
      type: "submenu",
      key: "share",
      content: "Share",
      items: [
        { type: "button", content: "Copy link", props: { style: minWidthStyle } },
        { type: "button", content: "Invite people" },
        { type: "link", content: "Manage access", props: { href: "#" } },
      ],
    },
    { type: "separator" },
    { type: "button", content: "Settings" },
  ] as const;
</script>

<svelte:head>
  <title>Menu — Keyboard</title>
</svelte:head>

{#snippet richRow()}
  <div class="row">
    <IconGithub size={16} />
    <div class="rich-content">
      <span>GitHub</span>
      <small>1ureka</small>
    </div>
  </div>
{/snippet}

{#snippet iconRow({ Icon, label }: { Icon?: typeof IconCheck; label: string })}
  <div class="row">
    {#if Icon}
      <Icon size={16} />
    {:else}
      <IconCheck size={16} style="visibility: hidden" />
    {/if}
    <span>{label}</span>
  </div>
{/snippet}

{#snippet checkableRow({ label, check }: { label: string; check: boolean })}
  <div class="row">
    <IconCheck size={16} style="visibility: {check ? 'visible' : 'hidden'}" />
    <span>{label}</span>
  </div>
{/snippet}

{#snippet simpleMenu()}
  <div bind:this={simpleMenuAnchor}>
    <Button
      id="showcase-menu-plain-trigger"
      onclick={() => (simpleMenuOpen = !simpleMenuOpen)}
      aria-expanded={simpleMenuOpen}
      aria-controls="showcase-menu-plain"
    >
      Workspace
      <span class="chevron" style="transform: {simpleMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">
        <IconChevronDown size={14} />
      </span>
    </Button>
  </div>

  <Menu
    id="showcase-menu-plain"
    labelledBy={{ triggerId: "showcase-menu-plain-trigger" }}
    open={simpleMenuOpen}
    reference={simpleMenuAnchor}
    items={simpleMenuItems}
    onclose={() => (simpleMenuOpen = false)}
  />
{/snippet}

{#snippet profileMenu()}
  <div bind:this={profileMenuAnchor}>
    <Button
      variant="primary"
      padding="icon"
      id="showcase-menu-profile-trigger"
      onclick={() => (profileMenuOpen = !profileMenuOpen)}
      aria-expanded={profileMenuOpen}
      aria-controls="showcase-menu-profile"
    >
      <IconUserFilled size={24} />
      <span class="chevron" style="transform: {profileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">
        <IconChevronDown size={14} />
      </span>
      <span class="sr-only">Profile menu</span>
    </Button>
  </div>

  <Menu
    id="showcase-menu-profile"
    labelledBy={{ triggerId: "showcase-menu-profile-trigger" }}
    open={profileMenuOpen}
    reference={profileMenuAnchor}
    placement="bottom"
    items={[
      { type: "label", content: "Signed in as 1ureka", props: { style: minWidthStyle } },
      {
        type: "link",
        content: { render: iconRow, props: { Icon: IconUserFilled, label: "Your profile" } },
        props: { href: "#" },
      },
      {
        type: "link",
        content: { render: iconRow, props: { Icon: IconCategoryFilled, label: "Your projects" } },
        props: { href: "#" },
      },
      { type: "separator" },
      {
        type: "submenu",
        key: "appearance",
        content: { render: iconRow, props: { Icon: IconBrush, label: "Appearance" } },
        items: [
          {
            type: "button",
            content: { render: checkableRow, props: { label: "Light", check: theme === "light" } },
            props: { style: minWidthStyle, onclick: () => (theme = "light"), "aria-pressed": theme === "light" },
          },
          {
            type: "button",
            content: { render: checkableRow, props: { label: "Dark", check: theme === "dark" } },
            props: { onclick: () => (theme = "dark"), "aria-pressed": theme === "dark" },
          },
          {
            type: "button",
            content: { render: checkableRow, props: { label: "System", check: theme === "system" } },
            props: { onclick: () => (theme = "system"), "aria-pressed": theme === "system" },
          },
        ],
      },
      {
        type: "submenu",
        key: "share-profile",
        content: "Share profile",
        items: [
          {
            type: "button",
            content: { render: iconRow, props: { Icon: IconLink, label: "Copy profile link" } },
            props: { style: minWidthStyle },
          },
          {
            type: "link",
            content: richRow,
            props: { href: "https://github.com/1ureka", target: "_blank", rel: "noopener noreferrer" },
          },
        ],
      },
      { type: "separator" },
      { type: "button", content: "Sign out" },
    ]}
    onclose={() => (profileMenuOpen = false)}
  />
{/snippet}

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      {@render simpleMenu()}
      <div class="separator" aria-hidden="true"></div>
      {@render profileMenu()}
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Menu"
  label="Keyboard"
  guide="Items sit where they open in the [[Tab]] sequence. Submenus do the same — expanding inline, right after their trigger."
  {preview}
/>

<style>
  .container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3rem;
    height: 3.5rem;
  }

  .separator {
    align-self: stretch;
    border-left: var(--border-style);
  }

  .chevron {
    display: inline-grid;
    place-items: center;
    transition: transform 0.15s ease;
    will-change: transform;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .rich-content {
    display: flex;
    flex-direction: column;
    font: var(--font-body2);
  }

  .rich-content > small {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }
</style>
