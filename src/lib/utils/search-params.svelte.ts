/**
 * @file search-params.svelte.ts
 * URL search params 與本地狀態同步的通用工具
 */

import { page } from "$app/state";
import { goto, replaceState } from "$app/navigation";
import { untrack } from "svelte";

/**
 * 單一 search param 的同步緩衝。
 */
export function syncedSearchParam(key: string, fallback = "") {
  let echo = untrack(() => page.url.searchParams.get(key) ?? fallback);
  let local = $state(echo);

  $effect(() => {
    const urlValue = page.url.searchParams.get(key) ?? fallback;
    if (urlValue !== echo) local = urlValue;
    echo = urlValue;
  });

  return {
    get value() {
      return local;
    },
    set value(v: string) {
      local = v;
    },
    /** 覆寫本地顯示值並同步導航，不等待 resolve */
    commit(v: string) {
      local = v;
      echo = v;
      const url = new URL(location.href);
      url.searchParams.set(key, v);
      goto(url, { keepFocus: true, replaceState: true, noScroll: true });
    },
  };
}

/**
 * 單一 search param 的同步緩衝，淺路由版本。
 */
export function shallowSearchParam(key: string) {
  // replaceState 是同步的、也不會更新 `page.url`（見 docs/svelte_kit_routes.md），
  // commit 不會觸發任何非同步、可能跟其他操作交錯的情況，純可覆寫的 `$derived` 就夠

  let local = $derived(page.url.searchParams.get(key));

  return {
    get value() {
      return local;
    },
    /** 覆寫本地顯示值並做一次淺路由，不會重跑 load */
    commit(v: string | null) {
      local = v;
      const params = new URLSearchParams(location.search);
      if (v !== null) params.set(key, v);
      else params.delete(key);
      const qs = params.toString();
      replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
    },
  };
}

/**
 * 多個 search params 共用同一個 commit 點的同步緩衝
 * 用於各自獨立呼叫 {@link syncedSearchParam} 並各自 `goto` 仍會互相覆蓋的情境
 */
export function syncedSearchParams<T extends Record<string, string>>(defaults: T) {
  const keys = Object.keys(defaults) as (keyof T)[];
  const snapshot = (): T => {
    const out = {} as T;
    for (const k of keys) out[k] = (page.url.searchParams.get(k as string) ?? defaults[k]) as T[typeof k];
    return out;
  };

  let echo = untrack(snapshot);
  const local = $state(snapshot());

  $effect(() => {
    const urlValue = snapshot();
    for (const k of keys) if (urlValue[k] !== echo[k]) local[k] = urlValue[k];
    echo = urlValue;
  });

  /** 送出目前 `local` 的完整快照並同步導航，不等待 resolve */
  function commit() {
    echo = { ...local };
    const url = new URL(location.href);
    for (const k of keys) url.searchParams.set(k as string, local[k]);
    goto(url, { keepFocus: true, replaceState: true, noScroll: true });
  }

  return { local, commit };
}

/**
 * 以任意「值物件」（需提供 `toSearchParams()`）作為整組 search params 的同步緩衝
 * 供有專屬 query-spec 值物件（如 `ImageQuery`）的頁面使用
 */
export function syncedQuery<T extends { toSearchParams(base?: URLSearchParams): URLSearchParams }>(
  parse: (params: URLSearchParams) => T,
) {
  const read = () => parse(page.url.searchParams);
  const key = (v: T) => v.toSearchParams().toString();

  let echo = untrack(read);
  let local = $state(untrack(read));

  $effect(() => {
    const next = read();
    if (key(next) !== key(echo)) local = next;
    echo = next;
  });

  /** 覆寫本地顯示值並同步導航，不等待 resolve；未變動的其他查詢參數會被保留 */
  function commit(next: T) {
    local = next;
    echo = next;
    const qs = next.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${location.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  return {
    get value() {
      return local;
    },
    commit,
  };
}
