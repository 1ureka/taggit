/**
 * 首頁網格的展示卡片資料，依分類分組；卡片連到的頁面內容則由各自的 +page.svelte 自行持有
 */

export type ShowcaseCategory = "Actions" | "Inputs" | "Floating" | "Display";

export type ShowcaseCard = {
  slug: string;
  component: string;
  label: string;
  blurb: string;
};

export const showcaseSections: { category: ShowcaseCategory; cards: ShowcaseCard[] }[] = [
  {
    category: "Actions",
    cards: [
      {
        slug: "button-variants",
        component: "Button",
        label: "Variants",
        blurb: "Heavier when the action matters, quieter when it's secondary, red when it can't be undone.",
      },
      {
        slug: "button-confirm",
        component: "Button",
        label: "Press and hold",
        blurb: "A long press provides a moment of deliberation to prevent accidental actions.",
      },
      {
        slug: "button-compositions",
        component: "Button",
        label: "Compositions",
        blurb: "In the wild, buttons take on diverse forms to blend into their surroundings.",
      },
    ],
  },
  {
    category: "Inputs",
    cards: [
      {
        slug: "type-field",
        component: "Text field",
        label: "Outlined & filled",
        blurb: "Outlined when the field needs definition, filled when it settles into the surface.",
      },
      {
        slug: "type-multiline",
        component: "Text field",
        label: "Multiple lines",
        blurb: "A text field that grows with its content.",
      },
      {
        slug: "type-context",
        component: "Text field",
        label: "In context",
        blurb: "Every context asks something different of the same field.",
      },
      {
        slug: "rating",
        component: "Rating",
        label: "Stars",
        blurb: "Hovering past the current score dims the stars it's about to give up.",
      },
      {
        slug: "checkbox",
        component: "Checkbox",
        label: "One box, composed the rest",
        blurb: "A plain toggle, a field list, unlabeled row selection, a select-all — all the same component.",
      },
      {
        slug: "select",
        component: "Select",
        label: "Closed options",
        blurb: "A trigger button opens a closed set of options — not for filtering free text.",
      },
      {
        slug: "combo",
        component: "Combo",
        label: "Filterable text input",
        blurb: "A text field that filters candidates — sync or async, the component can't tell the difference.",
      },
      {
        slug: "combo-tags",
        component: "Combo + Chip",
        label: "Tags input, composed not built-in",
        blurb: "Picking a candidate just pushes onto the caller's own tags array — no tags mode hiding inside Combo.",
      },
      {
        slug: "search-input",
        component: "TextInput + Popover + Chip",
        label: "Recent searches",
        blurb: "No dedicated search component — a text field, a popover, and chips wired together by the caller.",
      },
    ],
  },
  {
    category: "Floating",
    cards: [
      {
        slug: "tooltip-behavior",
        component: "Tooltip",
        label: "Hover and focus",
        blurb: "A single tooltip flies between anchors instead of fading out and in.",
      },
      {
        slug: "tooltip-scroll",
        component: "Tooltip",
        label: "Pinned while scrolling",
        blurb: "The tooltip stays pinned to its anchor with a spring follow.",
      },
      {
        slug: "menu-keyboard",
        component: "Menu",
        label: "Keyboard",
        blurb: "Items sit where they open in the tab sequence; submenus expand inline.",
      },
      {
        slug: "menu-context",
        component: "Menu",
        label: "Context menu",
        blurb: "Right-click somewhere else without closing first — the menu flies to the new point.",
      },
      {
        slug: "dialog-drawer",
        component: "Dialog",
        label: "Drawer",
        blurb: "A pull-out from the margin.",
      },
      {
        slug: "modal",
        component: "Dialog",
        label: "Modal",
        blurb: "Focus trap, escape, and focus return come free from the native <dialog>, not hand-rolled JS.",
      },
      {
        slug: "toast",
        component: "Toast",
        label: "Stacked notifications",
        blurb: "A module-level singleton — call addToast() from anywhere, no component instance needed.",
      },
    ],
  },
  {
    category: "Display",
    cards: [
      {
        slug: "chip",
        component: "Chip",
        label: "Token shell, composed the rest",
        blurb: "One base chip, extended by rest props instead of a growing prop list.",
      },
      {
        slug: "linear-progress",
        component: "LinearProgress",
        label: "Determinate & indeterminate",
        blurb: "One value prop, undefined means still running rather than zero.",
      },
      {
        slug: "image-canvas",
        component: "ImageCanvas",
        label: "Zoom & pan, any content",
        blurb: "Cursor-anchored zoom, rubber-band pan bounds — the content is just a snippet, images are the common case.",
      },
    ],
  },
];
