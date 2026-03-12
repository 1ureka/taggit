只能用 $state, $derived, $effect, untrack

$state, $derived 只能寫在 +page 或組件的無頭 UI，在這裡，我們統稱為狀態

只要是狀態，無論是 +page 還是 組件的無頭 UI，都能夠使用 $effect 與 untrack 來同步外部狀態，比如 SSR、search params

比如最簡單的 `let user = $state<User>(untrack(() => data.user))` + `$effect(() => { if (...) user = data.user })`

但是，極為重要，絕對不能忘記的是， SSR 的 data, page.url.searchParams 本來就是 read only 的 reactive object，若你沒有 "寫" 的需求，直接 $derived 就好，**不需要 $effect 與 untrack**

並且要遵循下放原則，假如頁面有個 SSR data，且有三個組件需要它，然而只有 C組件需要寫，那麼 A、B 組件直接透過 $props 原封不動拿 data 的值就好，只有 C 組件需要在其無頭 UI 內部使用 $state + untrack + $effect

此外， $effect 若是用於同步外部狀態，應該要就近寫

若需要 debounce:
統一用 $effect，不要用 afterNavigate + popstate，避免落下某些條件沒偵測到，與其細粒度找條件，不如完整偵測並自己決定條件:

用一個 draft: boolean 來判斷究竟要相信 page.url.searchParams 還是本地狀態，只要輸入就設 draft = true，只要 goto 就立刻設 draft = false， $effect 根據 draft 決定當下的 searchParams 變動需不需要同步到本地狀態

(補充，untrack 的引進是為了解決 SSR 後 $effect 以前的真空問題)
