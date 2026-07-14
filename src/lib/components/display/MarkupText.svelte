<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  type TokenType = "text" | "strong" | "em" | "code" | "kbd";

  interface Token {
    type: TokenType;
    content: string;
  }

  function parse(s: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < s.length) {
      // `code`
      if (s[i] === "`") {
        const end = s.indexOf("`", i + 1);
        if (end !== -1) {
          tokens.push({ type: "code", content: s.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }

      // [[kbd]]
      if (s[i] === "[" && s[i + 1] === "[") {
        const end = s.indexOf("]]", i + 2);
        if (end !== -1) {
          tokens.push({ type: "kbd", content: s.slice(i + 2, end) });
          i = end + 2;
          continue;
        }
      }

      // **strong**
      if (s[i] === "*" && s[i + 1] === "*") {
        const end = s.indexOf("**", i + 2);
        if (end !== -1) {
          tokens.push({ type: "strong", content: s.slice(i + 2, end) });
          i = end + 2;
          continue;
        }
      }

      // _em_
      if (s[i] === "_") {
        const end = s.indexOf("_", i + 1);
        if (end !== -1) {
          tokens.push({ type: "em", content: s.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }

      // plain text — accumulate until the next potential marker
      const markerRe = /[`\[*_]/;
      let j = i + 1;
      while (j < s.length && !markerRe.test(s[j])) j++;
      tokens.push({ type: "text", content: s.slice(i, j) });
      i = j;
    }

    return tokens;
  }

  let { markup, ...rest }: { markup: string } & HTMLAttributes<HTMLParagraphElement> = $props();

  const tokens = $derived(parse(markup));
</script>

<p {...rest}>
  {#each tokens as token}
    {#if token.type === "strong"}
      <strong>{token.content}</strong>
    {:else if token.type === "em"}
      <em>{token.content}</em>
    {:else if token.type === "code"}
      <code>{token.content}</code>
    {:else if token.type === "kbd"}
      <kbd>{token.content}</kbd>
    {:else}
      {token.content}
    {/if}
  {/each}
</p>

<style>
  p {
    font: var(--font-body1);
    color: var(--color-text);
  }

  strong {
    font-weight: 700;
    color: var(--color-accent);
  }

  em {
    font-style: italic;
    margin: 0 0.1em;
    color: var(--color-text);
  }

  code {
    font: var(--font-code);
    background-color: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 0.75);
    padding: 0.1em 0.35em;
  }

  kbd {
    font: var(--font-code);
    background-color: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 0.75);
    padding: 0.1em 0.4em;
    box-shadow: 0 2.5px 0 var(--color-border);
  }
</style>
