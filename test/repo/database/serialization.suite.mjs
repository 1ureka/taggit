/**
 * @file serialization.suite.mjs
 * serialization：emptyDBData / TagMetaCodec hydrate·prune / parseDBData 的 v1·v2 相容與寬容跳過。
 */

const fullRec = (over = {}) => ({
  name: "photo",
  tags: ["cat"],
  rating: 3,
  committedAt: 1000,
  updatedAt: 2000,
  fileSize: 10,
  width: 20,
  height: 30,
  blurhash: "abc",
  ...over,
});

export const name = "serialization";

export async function run(t, h) {
  const { emptyDBData, parseDBData, TagMetaCodec } = h.modules.serialization;

  // ── emptyDBData ──
  {
    const empty = emptyDBData();
    t.eq("emptyDBData 為 v2 空結構", empty, { version: 2, images: {}, tags: {} });
  }

  // ── TagMetaCodec.hydrate ──
  {
    t.eq("hydrate(undefined) 補為預設 hidden:false", TagMetaCodec.hydrate(undefined), { hidden: false });
    t.eq("hydrate({}) 補為預設", TagMetaCodec.hydrate({}), { hidden: false });
    t.eq("hydrate 保留 hidden:true", TagMetaCodec.hydrate({ hidden: true }), { hidden: true });
  }

  // ── TagMetaCodec.prune ──
  {
    t.eq("prune 全預設回 null（稀疏移除）", TagMetaCodec.prune({ hidden: false }), null);
    t.eq("prune 保留非預設 hidden:true", TagMetaCodec.prune({ hidden: true }), { hidden: true });
  }

  // ── parseDBData：非物件頂層 → 空 ──
  {
    t.eq("頂層非物件回 emptyDBData", parseDBData(null), { version: 2, images: {}, tags: {} });
    t.eq("頂層陣列回 emptyDBData", parseDBData([1, 2]), { version: 2, images: {}, tags: {} });
  }

  // ── parseDBData：v2 完整 ──
  {
    const parsed = parseDBData({
      version: 2,
      images: { "a.png": fullRec() },
      tags: { cat: { hidden: true } },
    });
    t.eq("v2 版本標為 2", parsed.version, 2);
    t.eq("v2 保留合法圖片紀錄", parsed.images["a.png"], fullRec());
    t.eq("v2 保留 hidden:true 標籤", parsed.tags, { cat: { hidden: true } });
  }

  // ── parseDBData：v1（無 tags 欄位）→ tags {} ──
  {
    const parsed = parseDBData({ version: 1, images: { "a.png": fullRec() } });
    t.eq("v1 缺 tags 欄位 → 空表", parsed.tags, {});
    t.eq("v1 版本升為 2", parsed.version, 2);
    t.ok("v1 圖片仍保留", parsed.images["a.png"] !== undefined);
  }

  // ── parseImages：寬容逐筆跳過壞紀錄 ──
  {
    const parsed = parseDBData({
      images: {
        good: fullRec(),
        missingFields: { name: "x" }, // 缺欄位
        wrongType: fullRec({ rating: "5" }), // rating 型別錯
        badTags: fullRec({ tags: [1, 2] }), // tags 非字串陣列
        notObject: 42, // 非物件
      },
    });
    t.eq("只保留合法紀錄，壞的逐筆跳過", Object.keys(parsed.images), ["good"]);
  }

  // ── parseTagsMeta：跳過壞值、prune 掉全預設 ──
  {
    const parsed = parseDBData({
      images: {},
      tags: {
        keepHidden: { hidden: true },
        dropDefault: { hidden: false }, // 全預設 → prune 掉
        badValue: 123, // 非物件 → 跳過
        badHiddenType: { hidden: "yes" }, // hidden 非布林 → hydrate 成預設 → prune 掉
      },
    });
    t.eq("tags 只留非預設且合法者", parsed.tags, { keepHidden: { hidden: true } });
  }

  // ── images 欄位整體格式錯 → 重置為空 ──
  {
    const parsed = parseDBData({ images: "not-an-object", tags: {} });
    t.eq("images 欄位非物件 → 空表", parsed.images, {});
  }
}

export default { name, run };
