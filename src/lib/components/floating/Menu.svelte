<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from "svelte/elements";
  import type { Placement } from "@floating-ui/dom";
  import type { OneOf } from "$lib/types";
  import Popover from "$lib/components/floating/Popover.svelte";
  import IconChevronDown from "$lib/icons/IconChevronDown.svelte";

  type Content = string | Snippet | { render: Snippet<[any]>; props: any };

  type MenuButtonOption = { type: "button"; content: Content; props?: HTMLButtonAttributes };
  type MenuLinkOption = { type: "link"; content: Content; props?: HTMLAnchorAttributes };
  type MenuLabel = { type: "label"; content: Content; props?: HTMLAttributes<HTMLElement> };
  type MenuSeparator = { type: "separator"; props?: HTMLAttributes<HTMLElement> };
  type MenuSubMenu = {
    type: "submenu";
    key: string;
    content: Content;
    props?: HTMLButtonAttributes;
    items: readonly MenuItem[];
  };

  type MenuItem = OneOf<[MenuButtonOption, MenuLinkOption, MenuLabel, MenuSeparator, MenuSubMenu]>;

  // ---

  type Props = Omit<HTMLAttributes<HTMLElement>, "id"> & {
    /** 開關狀態 */
    open: boolean;
    /** 選單關閉事件 */
    onclose?: () => void;
    /** 參照元素（定位錨點） */
    reference: HTMLElement | undefined;
    /** 偏好位置，預設 'bottom-start' */
    placement?: Placement;
    /** 是否匹配參照元素寬度，預設 false */
    matchWidth?: boolean;
    /** 離參照元素的距離，預設 4px */
    offset?: number;
    /** 選單項目 */
    items: readonly MenuItem[];
    /** ? */
    crossfadeKey?: string;
    /**
     * 此 Menu 在文件中的 id。會作為 root 的 id，也是 trigger 端 `aria-controls` 的目標。
     */
    id: string | { ariaSkipped: true; reason: string };
    /**
     * - `triggerId`：對應的觸發按鈕 id，會輸出 `aria-labelledby={triggerId}`。
     * - `label`：直接給字串，會輸出 `aria-label={label}`。
     */
    labelledBy: OneOf<[{ triggerId: string }, { label: string }]>;
  };

  const currentId = $props.id();

  let {
    open,
    onclose,
    reference,
    placement = "bottom-start",
    matchWidth = false,
    offset = 4,
    items,
    crossfadeKey,
    id,
    labelledBy,
    ...rest
  }: Props = $props();

  (() => {
    if (items.length === 0) {
      console.warn("Menu component received empty items array.");
    }
  })();

  // ---

  const menuRootId = $derived(typeof id === "string" ? id : currentId);

  let menuRef = $state<HTMLElement>();
  let subAnchors = $state<Record<string, HTMLElement>>({});
  let subMenuRefs = $state<Record<string, HTMLElement>>({});

  type OpenSource = "hover" | "click";
  let openSources = $state<OpenSource[]>([]);
  let openPath = $state<string[]>([]); // 由淺到深，每層存目前展開的 submenu key

  // ---

  const isTargetRelated = (key: string, target: EventTarget | null): boolean => {
    if (!(target instanceof Node)) return false;
    const trigger = subAnchors[key];
    const content = subMenuRefs[key];
    return (trigger?.contains(target) ?? false) || (content?.contains(target) ?? false);
  };

  const openTo = (key: string, level: number, source: OpenSource) => {
    openPath = [...openPath.slice(0, level), key];
    openSources = [...openSources.slice(0, level), source];
  };

  const closeFrom = (level: number) => {
    openPath = openPath.slice(0, level);
    openSources = openSources.slice(0, level);
  };

  const closeHoverFrom = (level: number) => {
    let target = openPath.length;
    while (target > level && openSources[target - 1] === "hover") target--;
    if (target < openPath.length) {
      closeFrom(target);
    }
  };

  // ---

  const createSubMenuHandlers = (key: string, level: number) => ({
    onclick: () => {
      if (openPath[level] === key && openSources[level] === "click") {
        closeFrom(level);
      } else {
        openTo(key, level, "click");
      }
    },
    onmouseenter: () => {
      if (openPath[level] !== key) openTo(key, level, "hover");
    },
    onfocusin: () => {
      if (openPath[level] !== key) openTo(key, level, "hover");
    },
    onmouseleave: (e: MouseEvent) => {
      if (!isTargetRelated(key, e.relatedTarget)) closeHoverFrom(level);
    },
    onfocusout: (e: FocusEvent) => {
      if (!isTargetRelated(key, e.relatedTarget)) closeHoverFrom(level);
    },
  });

  const createSubMenuContentHandlers = (key: string, level: number) => ({
    onmouseleave: (e: MouseEvent) => {
      if (!isTargetRelated(key, e.relatedTarget)) closeHoverFrom(level);
    },
    onfocusout: (e: FocusEvent) => {
      if (!isTargetRelated(key, e.relatedTarget)) closeFrom(level);
    },
  });

  // ---

  const handleWindowClick = (event: MouseEvent) => {
    if (!open || !menuRef || !reference) return;

    const target = event.target;
    if (!target || !(target instanceof Element)) {
      onclose?.();
    } else if (!menuRef.contains(target) && !reference.contains(target)) {
      onclose?.();
    }
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      onclose?.();
    }
  };
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeyDown} />

{#snippet menuItemContent(content: Content)}
  {#if typeof content === "string"}
    <span>{content}</span>
  {:else if typeof content === "object" && "render" in content}
    {@render content.render(content.props)}
  {:else}
    {@render content()}
  {/if}
{/snippet}

{#snippet menuItems(items: readonly MenuItem[], currentLevel: number)}
  {#each items as item}
    {#if item.type === "button"}
      <li role="listitem">
        <button class="menu-item" type="button" {...item.props}>
          {@render menuItemContent(item.content)}
        </button>
      </li>
    {:else if item.type === "link"}
      <li role="listitem">
        <a class="menu-item" {...item.props}>
          {@render menuItemContent(item.content)}
        </a>
      </li>
    {:else if item.type === "label"}
      <li class="menu-label" role="presentation" {...item.props}>
        {@render menuItemContent(item.content)}
      </li>
    {:else if item.type === "separator"}
      <li class="menu-separator" role="separator" aria-orientation="horizontal" {...item.props}></li>
    {:else if item.type === "submenu"}
      <li role="listitem">
        <button
          bind:this={subAnchors[item.key]}
          id="{menuRootId}-trigger-{item.key}"
          class="menu-item"
          aria-expanded={openPath[currentLevel] === item.key}
          aria-controls="{menuRootId}-submenu-{item.key}"
          type="button"
          {...createSubMenuHandlers(item.key, currentLevel)}
          {...item.props}
        >
          {@render menuItemContent(item.content)}
          <IconChevronDown style="margin-left: auto; transform: rotate(-90deg);" size={14} />
        </button>
        {#if subAnchors[item.key]}
          {@render submenu(item.key, item.items, currentLevel)}
        {/if}
      </li>
    {/if}
  {/each}
{/snippet}

{#snippet submenu(key: string, items: readonly MenuItem[], currentLevel: number)}
  <Popover
    open={openPath[currentLevel] === key}
    reference={subAnchors[key]}
    placement="right-start"
    offset={0}
    crossfadeKey={currentId}
  >
    <ul
      bind:this={subMenuRefs[key]}
      id="{menuRootId}-submenu-{key}"
      class="menu"
      role="list"
      aria-labelledby="{menuRootId}-trigger-{key}"
      {...createSubMenuContentHandlers(key, currentLevel)}
    >
      {@render menuItems(items, currentLevel + 1)}
    </ul>
  </Popover>
{/snippet}

<Popover {open} {reference} {placement} {matchWidth} {offset} {crossfadeKey}>
  <ul
    id={menuRootId}
    class="menu"
    role="list"
    aria-labelledby={"triggerId" in labelledBy ? labelledBy.triggerId : undefined}
    aria-label={"label" in labelledBy ? labelledBy.label : undefined}
    bind:this={menuRef}
    {...rest}
  >
    {@render menuItems(items, 0)}
  </ul>
</Popover>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    padding: 0.25rem;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    list-style: none;
  }

  /* --- */

  li[role="listitem"] {
    display: grid;
    place-items: stretch;
  }

  .menu-item {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-radius: calc(var(--border-radius) * 1.5 - 0.25rem);
    font: var(--font-body2);
    color: var(--color-text);
  }

  .menu-item {
    background-color: transparent;
    transition: all 0.15s ease;
    will-change: transform;

    &:hover {
      background-color: var(--color-bg-hover);
    }

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }

    &:disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    &[aria-expanded="true"] {
      background-color: var(--color-bg-active);
    }
  }

  a.menu-item {
    text-decoration: none;

    &:hover,
    &:focus-visible {
      text-decoration: underline;
    }
  }

  /* --- */

  .menu-label {
    padding: 0 0.25rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  .menu-separator {
    border-top: var(--border-style);
    margin: 0.25rem 0;
  }
</style>
