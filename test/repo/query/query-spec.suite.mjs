/**
 * @file query-spec.suite.mjs
 * query-spec 值物件（isomorphic）：parse 純函式 + 各值物件的 fromSearchParams / toSearchParams /
 * with / 預設值。round-trip 與「預設值省略」是重點。
 */

const sp = (obj) => new URLSearchParams(obj);
/** toSearchParams → 排序過的 key=value 字串，穩定可比。 */
const dump = (params) =>
  [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

export const name = "query-spec (value objects)";

export async function run(t, h) {
  const { parseTags, safeInt, parseEnum, parseBool, ImageWhere, TagWhere, ListOptions, ImageQuery, TagQuery, TagFacetQuery } =
    h.modules;

  // ── parse 純函式 ──
  {
    t.eq("parseTags null → 空", parseTags(null), []);
    t.eq("parseTags 修剪 + 濾空 + 濾尾逗號", parseTags("a, b ,,c,"), ["a", "b", "c"]);
    t.eq("safeInt null → undefined", safeInt(null), undefined);
    t.eq("safeInt 非數字 → undefined", safeInt("abc"), undefined);
    t.eq("safeInt 小數截斷", safeInt("3.7"), 3);
    t.eq("safeInt 負數", safeInt("-2"), -2);
    t.eq("safeInt Infinity → undefined", safeInt("Infinity"), undefined);
    t.eq("parseEnum 合法收窄", parseEnum("gte", ["gte", "lte", "eq"]), "gte");
    t.eq("parseEnum 非法 → undefined", parseEnum("xx", ["gte", "lte", "eq"]), undefined);
    t.eq("parseBool true", parseBool("true"), true);
    t.eq("parseBool false", parseBool("false"), false);
    t.eq("parseBool 其他 → undefined", parseBool("1"), undefined);
  }

  // ── ImageWhere 預設 / with / round-trip ──
  {
    const w = new ImageWhere();
    t.eq("ImageWhere 預設", w.fields(), { search: "", includedTags: [], excludedTags: [], rating: undefined, ratingOp: "gte" });
    t.eq("預設 toSearchParams 全省略", dump(w.toSearchParams()), "");

    const w2 = w.with({ search: "cat", includedTags: ["a", "b"], rating: 3, ratingOp: "lte" });
    t.eq("with 覆寫欄位", w2.fields(), {
      search: "cat",
      includedTags: ["a", "b"],
      excludedTags: [],
      rating: 3,
      ratingOp: "lte",
    });
    t.eq("with 不動原物件", w.search, "");

    const round = ImageWhere.fromSearchParams(w2.toSearchParams());
    t.eq("ImageWhere round-trip", round.fields(), w2.fields());

    // ratingOp=gte 為預設，應省略
    const gte = new ImageWhere({ rating: 2, ratingOp: "gte" });
    t.eq("ratingOp 預設 gte 省略但保留 rating", dump(gte.toSearchParams()), "rating=2");
  }

  // ── TagWhere 預設 / with（"in patch" 可設 undefined）/ round-trip ──
  {
    const w = new TagWhere();
    t.eq("TagWhere 預設", { name: w.name, hidden: w.hidden, universe: w.universe }, { name: undefined, hidden: undefined, universe: "used" });
    t.eq("預設 toSearchParams 全省略", dump(w.toSearchParams()), "");

    const w2 = w.with({ hidden: true, universe: "all", name: "ca" });
    t.eq("with 覆寫", { name: w2.name, hidden: w2.hidden, universe: w2.universe }, { name: "ca", hidden: true, universe: "all" });
    t.eq("非預設 toSearchParams", dump(w2.toSearchParams()), "hidden=true&name=ca&universe=all");

    // with({ hidden: undefined }) 應能清掉 hidden（"hidden" in patch 為 true）
    const cleared = w2.with({ hidden: undefined });
    t.eq("with 顯式傳 undefined 可清空 hidden", cleared.hidden, undefined);

    const round = TagWhere.fromSearchParams(w2.toSearchParams());
    t.eq("TagWhere round-trip", { name: round.name, hidden: round.hidden, universe: round.universe }, { name: "ca", hidden: true, universe: "all" });
  }

  // ── ListOptions 預設 / with ──
  {
    const l = new ListOptions({ sort: "rating" });
    t.eq("ListOptions 預設 order desc / page 1 / limit 0", { order: l.order, page: l.page, limit: l.limit }, { order: "desc", page: 1, limit: 0 });
    const l2 = l.with({ page: 3, limit: 20, order: "asc" });
    t.eq("with 覆寫分頁", { sort: l2.sort, order: l2.order, page: l2.page, limit: l2.limit }, { sort: "rating", order: "asc", page: 3, limit: 20 });
  }

  // ── ImageQuery 預設 sort=rating / round-trip ──
  {
    const q = new ImageQuery();
    t.eq("ImageQuery 預設 sort rating / order desc", { sort: q.list.sort, order: q.list.order }, { sort: "rating", order: "desc" });
    t.eq("預設 toSearchParams 全省略", dump(q.toSearchParams()), "");

    const parsed = ImageQuery.fromSearchParams(sp({ search: "x", includedTags: "a,b", sort: "name", order: "asc", page: "2", limit: "10" }));
    t.eq("ImageQuery from params where", parsed.where.fields(), { search: "x", includedTags: ["a", "b"], excludedTags: [], rating: undefined, ratingOp: "gte" });
    t.eq("ImageQuery from params list", { sort: parsed.list.sort, order: parsed.list.order, page: parsed.list.page, limit: parsed.list.limit }, { sort: "name", order: "asc", page: 2, limit: 10 });
    t.eq("ImageQuery to params 反映非預設", dump(parsed.toSearchParams()), "includedTags=a,b&limit=10&order=asc&page=2&search=x&sort=name");

    // 非法 sort 落回預設 rating
    const bad = ImageQuery.fromSearchParams(sp({ sort: "bogus" }));
    t.eq("非法 sort 落回 rating", bad.list.sort, "rating");
  }

  // ── TagQuery 預設 sort=count ──
  {
    const q = new TagQuery();
    t.eq("TagQuery 預設 sort count / order desc", { sort: q.list.sort, order: q.list.order }, { sort: "count", order: "desc" });
    const parsed = TagQuery.fromSearchParams(sp({ name: "ca", hidden: "true", sort: "name", limit: "5" }));
    t.eq("TagQuery from params", { name: parsed.where.name, hidden: parsed.where.hidden, sort: parsed.list.sort, limit: parsed.list.limit }, { name: "ca", hidden: true, sort: "name", limit: 5 });
  }

  // ── TagFacetQuery：scope 必填、where/list 委派 tags ──
  {
    const scope = new ImageWhere({ includedTags: ["cat"] });
    const facet = new TagFacetQuery(scope);
    t.eq("TagFacetQuery scope 保留", facet.scope.includedTags, ["cat"]);
    t.eq("where getter 委派 tags.where（預設）", facet.where.universe, "used");
    t.eq("list getter 委派 tags.list（預設 count）", facet.list.sort, "count");

    const withTags = facet.with({ tags: new TagQuery(new TagWhere({ hidden: true })) });
    t.eq("with 覆寫 tags 後 where 反映", withTags.where.hidden, true);
    t.eq("with 不動 scope", withTags.scope.includedTags, ["cat"]);

    const fromParams = TagFacetQuery.fromSearchParams(sp({ includedTags: "dog", rating: "4" }));
    t.eq("fromSearchParams 只解析 scope", fromParams.scope.fields().includedTags, ["dog"]);
    t.eq("fromSearchParams scope rating", fromParams.scope.rating, 4);
  }

  // ── toSearchParams(base)：合併進既有參數、保留外來鍵、清掉回退預設的殘留鍵、不 mutate base ──
  {
    // base 同時帶頁面自有參數(modal/currentId)、一個會回退預設的舊 where 值(ratingOp=lte)、與舊 list 值(sort/page)
    const base = sp({ modal: "1", currentId: "42", ratingOp: "lte", search: "old", sort: "name", page: "3" });
    const before = base.toString();

    // ImageWhere 只擁有 where 鍵：清掉自己的，但不動 list 的 sort/page（擁有權邊界）
    const w = new ImageWhere({ search: "cat", rating: 5 });
    const wMerged = w.toSearchParams(base);
    t.eq("ImageWhere(base) 覆寫 search", wMerged.get("search"), "cat");
    t.eq("ImageWhere(base) 清掉回退預設的 ratingOp", wMerged.has("ratingOp"), false);
    t.eq("ImageWhere(base) 保留外來鍵 modal", wMerged.get("modal"), "1");
    t.eq("ImageWhere(base) 不碰非自有的 sort", wMerged.get("sort"), "name");

    // ImageQuery 擁有 where + list 鍵：兩組都清，只留外來鍵
    const q = new ImageQuery(new ImageWhere({ search: "cat", rating: 5 }));
    const merged = q.toSearchParams(base);
    t.eq("ImageQuery(base) 覆寫 search", merged.get("search"), "cat");
    t.eq("ImageQuery(base) 寫入 rating", merged.get("rating"), "5");
    t.eq("ImageQuery(base) 保留外來鍵", `${merged.get("modal")},${merged.get("currentId")}`, "1,42");
    t.eq("ImageQuery(base) 清掉回退預設的 ratingOp", merged.has("ratingOp"), false);
    t.eq("ImageQuery(base) 清掉回退預設的 sort", merged.has("sort"), false);
    t.eq("ImageQuery(base) 清掉回退預設的 page", merged.has("page"), false);
    t.eq("toSearchParams(base) 不 mutate 傳入的 base", base.toString(), before);

    // reset：預設查詢覆蓋 base → 清光全部 owned 鍵、只留外來鍵
    const reset = new ImageQuery().toSearchParams(base);
    t.eq("reset 清光 owned 鍵只留外來鍵", dump(reset), "currentId=42&modal=1");

    // Tag 領域同樣適用
    const tagBase = sp({ modal: "x", universe: "all", sort: "name" });
    const tagMerged = new TagQuery(new TagWhere({ name: "ca" })).toSearchParams(tagBase);
    t.eq("TagQuery(base) 覆寫 name", tagMerged.get("name"), "ca");
    t.eq("TagQuery(base) 清掉回退預設的 universe", tagMerged.has("universe"), false);
    t.eq("TagQuery(base) 清掉回退預設的 sort", tagMerged.has("sort"), false);
    t.eq("TagQuery(base) 保留外來鍵", tagMerged.get("modal"), "x");
  }
}

export default { name, run };
