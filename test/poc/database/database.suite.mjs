/**
 * @file database.suite.mjs
 * Database 實例層：真相 CRUD、tag meta 稀疏、索引維護（replaceIndex 增/改/刪、rebuild、
 * 壓實觸發、錯誤路徑）、投影查詢、以及單例載入 / seedFile 相容。
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

/** 依當前投影，把某標籤位元圖攤成 id 陣列（升冪）。 */
const idsWithTag = (db, tag) => {
  const bits = db.tagBits(tag);
  if (!bits) return [];
  return [...bits.values()].map((o) => db.idOf(o)).filter((x) => x !== null);
};

export const name = "database (Database)";

export async function run(t, h) {
  const { freshDb, seedFile } = h;

  // ── 真相 CRUD ──
  {
    const db = freshDb();
    t.eq("空 db imageCount 0", db.imageCount(), 0);
    t.eq("缺席 getImage 回 null", db.getImage("a"), null);
    t.ok("缺席 hasImage false", db.hasImage("a") === false);

    db.setImage("a", rec({ name: "A" }));
    t.eq("setImage 後 imageCount 1", db.imageCount(), 1);
    t.ok("setImage 後 hasImage true", db.hasImage("a"));
    t.eq("getImage 取回", db.getImage("a").name, "A");
    t.eq("imageEntries 列出", db.imageEntries().map(([id]) => id), ["a"]);

    db.deleteImage("a");
    t.eq("deleteImage 後 imageCount 0", db.imageCount(), 0);
  }

  // ── tag meta 稀疏儲存 ──
  {
    const db = freshDb();
    t.eq("缺席 getTagMeta 回 hydrate 後預設", db.getTagMeta("cat"), { hidden: false });
    t.eq("tagMetaEntries 起始為空", db.tagMetaEntries(), []);

    db.setTagMeta("cat", { hidden: true });
    t.eq("setTagMeta hidden:true 後取回", db.getTagMeta("cat"), { hidden: true });
    t.eq("tagMetaEntries 只列非預設（稀疏）", db.tagMetaEntries(), [["cat", { hidden: true }]]);

    // 全預設寫入應 prune 移除表項
    db.setTagMeta("cat", { hidden: false });
    t.eq("setTagMeta 全預設 → prune 移除表項", db.tagMetaEntries(), []);

    db.setTagMeta("dog", { hidden: true });
    db.deleteTagMeta("dog");
    t.eq("deleteTagMeta 移除", db.tagMetaEntries(), []);
  }

  // ── replaceIndex：純新增（oldRec null）──
  {
    const db = freshDb();
    db.setImage("a", rec({ tags: ["cat"], rating: 3 }));
    db.replaceIndex("a", null);
    t.eq("新增後序號指派", db.ordinalOf("a"), 0);
    t.eq("新增後 cat 投影含 a", idsWithTag(db, "cat"), ["a"]);
    t.eq("新增後 rating 投影命中", [...db.ratingRange(3, 3).values()].map((o) => db.idOf(o)), ["a"]);
    t.eq("liveClone 含該序號", [...db.liveClone.values()], [0]);
  }

  // ── replaceIndex：更新（oldRec 提供，標籤/評分搬移）──
  {
    const db = freshDb();
    const old = rec({ tags: ["cat"], rating: 3 });
    db.setImage("a", old);
    db.replaceIndex("a", null);

    const next = rec({ tags: ["dog"], rating: 5 });
    db.setImage("a", next); // 先寫真相
    db.replaceIndex("a", old); // 再同步（出舊 cat/3、進新 dog/5）
    t.eq("更新後舊標籤 cat 投影清空", idsWithTag(db, "cat"), []);
    t.eq("更新後新標籤 dog 投影命中", idsWithTag(db, "dog"), ["a"]);
    t.eq("更新後舊評分 3 不再命中", [...db.ratingRange(3, 3).values()], []);
    t.eq("更新後新評分 5 命中", [...db.ratingRange(5, 5).values()].map((o) => db.idOf(o)), ["a"]);
  }

  // ── replaceIndex：刪除（真相缺席 → 純移除）──
  {
    const db = freshDb();
    const r = rec({ tags: ["cat"] });
    db.setImage("a", r);
    db.replaceIndex("a", null);
    db.deleteImage("a"); // 先寫真相（刪）
    db.replaceIndex("a", r); // 再同步
    t.eq("刪除後 cat 投影清空", idsWithTag(db, "cat"), []);
    t.eq("刪除後 ordinalOf 為 undefined（墓碑）", db.ordinalOf("a"), undefined);
    t.eq("刪除後 liveClone 空", [...db.liveClone.values()], []);
  }

  // ── rebuild：從真相全量重建 ──
  {
    const db = freshDb();
    db.setImage("a", rec({ tags: ["cat"] }));
    db.setImage("b", rec({ tags: ["cat", "dog"] }));
    db.rebuild();
    t.eq("rebuild 後 cat 投影", idsWithTag(db, "cat").sort(), ["a", "b"]);
    t.eq("rebuild 後 dog 投影", idsWithTag(db, "dog"), ["b"]);
    t.eq("rebuild 後 imageCount", db.imageCount(), 2);
  }

  // ── replaceIndex 錯誤路徑：oldRec null 但 id 已在索引 → 記 error 後整體 rebuild、投影仍一致 ──
  {
    const db = freshDb();
    db.setImage("a", rec({ tags: ["cat"] }));
    db.replaceIndex("a", null); // 正常建索引
    // 呼叫端說謊：id 已索引卻傳 null。實作應偵測並 rebuild 而非崩潰。
    t.notThrows("錯誤 oldRec 不崩潰", () => db.replaceIndex("a", null));
    t.eq("錯誤路徑後投影仍與真相一致", idsWithTag(db, "cat"), ["a"]);
    t.eq("錯誤路徑後 imageCount 未變", db.imageCount(), 1);
  }

  // ── 壓實觸發：大量刪除使墓碑數 > 存活數，replaceIndex 內部 rebuild 收斂 ──
  {
    const db = freshDb();
    for (let i = 0; i < 10; i++) {
      db.setImage(`img${i}`, rec({ tags: ["t"] }));
      db.replaceIndex(`img${i}`, null);
    }
    // 刪掉 8 張：墓碑 8 > 存活 2，會在某次 replaceIndex 觸發 rebuild 壓實
    for (let i = 0; i < 8; i++) {
      const r = db.getImage(`img${i}`);
      db.deleteImage(`img${i}`);
      db.replaceIndex(`img${i}`, r);
    }
    t.eq("壓實後存活圖片剩 2", db.imageCount(), 2);
    t.eq("壓實後 t 投影只含存活兩張", idsWithTag(db, "t").sort(), ["img8", "img9"]);
    // 壓實會重新指派稠密序號（0..1），舊墓碑序號不殘留
    const live = [...db.liveClone.values()];
    t.ok("壓實後序號稠密重排（最大序號 < 存活數的兩倍）", Math.max(...live) < 4);
  }

  // ── 單例載入 + seedFile 相容 ──
  {
    const db = seedFile({
      version: 2,
      images: {
        "a.png": rec({ name: "A", tags: ["cat"], rating: 4 }),
        "b.png": rec({ name: "B", tags: ["cat", "dog"], rating: 2 }),
      },
      tags: { dog: { hidden: true } },
    });
    t.eq("seedFile 載入圖片數", db.imageCount(), 2);
    t.eq("seedFile 後投影已由 load 內 rebuild 建好", idsWithTag(db, "cat").sort(), ["a.png", "b.png"]);
    t.eq("seedFile 後 tag meta 載入", db.getTagMeta("dog"), { hidden: true });
    t.ok("seedFile 後 isLoaded", h.modules.Database.isLoaded());
  }
}

export default { name, run };
