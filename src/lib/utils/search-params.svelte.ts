/**
 * @file search-params.svelte.ts
 * URL search params 與本地狀態同步的通用工具
 */

import { page } from "$app/state";
import { goto, replaceState } from "$app/navigation";
import { untrack } from "svelte";

/**
 * 單一路由查詢參數
 */
export class SvelteSearchParam {
  private key: string;
  private fallback: string;
  private echo: string;
  private local = $state("");

  constructor(key: string, fallback = "") {
    this.key = key;
    this.fallback = fallback;

    const read = () => page.url.searchParams.get(key) ?? fallback;
    this.echo = untrack(read);
    this.local = untrack(read);

    $effect(() => {
      const urlValue = page.url.searchParams.get(this.key) ?? this.fallback;
      if (urlValue !== this.echo) this.local = urlValue;
      this.echo = urlValue;
    });
  }

  get value() {
    return this.local;
  }

  /** 覆寫本地顯示值並做導航 */
  set(v: string) {
    this.local = v;
    this.echo = v;
    const url = new URL(location.href);
    url.searchParams.set(this.key, v);
    goto(url, { keepFocus: true, replaceState: true, noScroll: true });
  }
}

/**
 * 單一淺路由查詢參數
 */
export class SvelteShallowParam {
  private key: string;
  private local: string | null;

  constructor(key: string) {
    this.key = key;
    this.local = $derived(page.url.searchParams.get(this.key));
  }

  get value() {
    return this.local;
  }

  /** 覆寫本地顯示值並做一次淺路由 */
  set(v: string | null) {
    this.local = v;
    const params = new URLSearchParams(location.search);
    if (v !== null) params.set(this.key, v);
    else params.delete(this.key);
    const qs = params.toString();
    replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }
}

/** 所有查詢參數的字串與任意型別轉換方式 */
type Codec<T> = {
  parse: (params: URLSearchParams) => T;
  serialize: (value: T, base?: URLSearchParams) => URLSearchParams;
};

/**
 * 一組或複雜路由查詢參數
 */
export class SvelteSearchParams<T> {
  private codec: Codec<T>;
  private echo: T;
  private local = $state<T>(undefined as T);

  constructor(codec: Codec<T>) {
    this.codec = codec;

    const read = () => codec.parse(page.url.searchParams);
    this.echo = untrack(read);
    this.local = untrack(read);

    $effect(() => {
      const next = this.codec.parse(page.url.searchParams);
      const key = (v: T) => this.codec.serialize(v).toString();
      if (key(next) !== key(this.echo)) this.local = next;
      this.echo = next;
    });
  }

  get value() {
    return this.local;
  }

  /** 覆寫本地顯示值並做導航 */
  set(next: T) {
    this.local = next;
    this.echo = next;
    const qs = this.codec.serialize(next, new URLSearchParams(location.search)).toString();
    goto(`${location.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  }
}

/**
 * 一組或複雜淺路由查詢參數
 */
export class SvelteShallowParams<T> {
  private codec: Codec<T>;
  private local: T;

  constructor(codec: Codec<T>) {
    this.codec = codec;
    this.local = $derived(this.codec.parse(page.url.searchParams));
  }

  get value() {
    return this.local;
  }

  /** 覆寫本地顯示值並做一次淺路由 */
  set(next: T) {
    this.local = next;
    const qs = this.codec.serialize(next, new URLSearchParams(location.search)).toString();
    replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }
}
