/**
 * @file facet-index.suite.mjs
 * FacetIndex：tag 位元圖增刪、空位元圖刪除、ratingRange 聯集與端點/越界夾制、clampRating、clear。
 */

const rec = (over = {}) => ({
  name: "n",
  tags: [],
  rating: 0,
  committedAt: 0,
  updatedAt: 0,
  fileSize: 0,
  width: 0,
  height: 0,
  blurhash: "",
  ...over,
});

export const name = "facet-index (FacetIndex)";

export async function run(t, h) {
  const { FacetIndex } = h.modules;

  // ── add / getTagBits ──
  {
    const fx = new FacetIndex();
    fx.add(0, rec({ tags: ["cat", "dog"], rating: 3 }));
    fx.add(1, rec({ tags: ["cat"], rating: 3 }));
    t.eq("cat 位元圖含兩張圖", [...fx.getTagBits("cat").values()], [0, 1]);
    t.eq("dog 位元圖含一張圖", [...fx.getTagBits("dog").values()], [0]);
    t.eq("不存在標籤回 undefined", fx.getTagBits("bird"), undefined);
  }

  // ── remove：清 bit，空掉的標籤位元圖一併刪除 ──
  {
    const fx = new FacetIndex();
    const r = rec({ tags: ["solo"], rating: 2 });
    fx.add(0, r);
    t.ok("加入後 solo 存在", fx.getTagBits("solo") !== undefined);
    fx.remove(0, r);
    t.eq("移除最後一張後 solo 位元圖被刪除", fx.getTagBits("solo"), undefined);
  }
  {
    const fx = new FacetIndex();
    fx.add(0, rec({ tags: ["shared"] }));
    fx.add(1, rec({ tags: ["shared"] }));
    fx.remove(0, rec({ tags: ["shared"] }));
    t.eq("移除其一後 shared 位元圖仍在且剩 1", [...fx.getTagBits("shared").values()], [1]);
  }

  // ── ratingRange：含端點的聯集 ──
  {
    const fx = new FacetIndex();
    fx.add(0, rec({ rating: 0 }));
    fx.add(1, rec({ rating: 3 }));
    fx.add(2, rec({ rating: 5 }));
    fx.add(3, rec({ rating: 3 }));
    t.eq("ratingRange 精確 [3,3]", [...fx.ratingRange(3, 3).values()], [1, 3]);
    t.eq("ratingRange [3,5] 含端點聯集", [...fx.ratingRange(3, 5).values()], [1, 2, 3]);
    t.eq("ratingRange [0,5] 全體", [...fx.ratingRange(0, 5).values()], [0, 1, 2, 3]);
    t.eq("ratingRange 越界端點被夾制 [ -2, 99 ]", [...fx.ratingRange(-2, 99).values()], [0, 1, 2, 3]);
    t.eq("ratingRange 與有效評分無交集回空 [ 6, 9 ]", [...fx.ratingRange(6, 9).values()], []);
  }

  // ── clampRating：壞評分收斂 ──
  {
    const fx = new FacetIndex();
    fx.add(0, rec({ rating: -1 })); // → 0
    fx.add(1, rec({ rating: 2.7 })); // 非整數 → 0
    fx.add(2, rec({ rating: 99 })); // → 5
    t.eq("負評分收斂到 0 桶", [...fx.ratingRange(0, 0).values()], [0, 1]);
    t.eq("超界評分收斂到 5 桶", [...fx.ratingRange(5, 5).values()], [2]);
  }

  // ── clear ──
  {
    const fx = new FacetIndex();
    fx.add(0, rec({ tags: ["x"], rating: 4 }));
    fx.clear();
    t.eq("clear 後標籤位元圖消失", fx.getTagBits("x"), undefined);
    t.eq("clear 後 ratingRange 全空", [...fx.ratingRange(0, 5).values()], []);
  }
}

export default { name, run };
