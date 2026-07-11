/**
 * @file mutation-validation.suite.mjs
 * Mutation 的「邊界」證明：所有對外方法現在都收 unknown，內部逐欄位跑 Validator。
 *
 * 本 suite 只餵「型別垃圾」——非物件 entry、tags 非陣列、rating 非數字、
 * expectedUpdatedAt 非數字、tagMeta.hidden 非布林、標籤名非字串——並斷言一律回 validation。
 * 合法輸入的行為由 mutation.suite.mjs 涵蓋，這裡不重複。
 */

const FILE = { fileSize: 1, width: 2, height: 3, blurhash: "bh" };

export const name = "mutation-validation (unknown-in 邊界)";

export async function run(t, h) {
  const { Mutation } = h.modules;

  /** 斷言某次 mutation 呼叫回 validation 失敗。 */
  const isValidation = (r) => r.ok === false && r.error.kind === "validation";

  // ── commitRecord：非物件 entry / 欄位型別垃圾 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const bad = (label, entry) => t.ok(label, isValidation(m.commitRecord("x.png", entry, FILE)));

    bad("commit 非物件 entry(字串) → validation", "not-an-object");
    bad("commit 非物件 entry(null) → validation", null);
    bad("commit 非物件 entry(陣列) → validation", ["a"]);
    bad("commit 非物件 entry(數字) → validation", 42);
    bad("commit name 非字串 → validation", { name: 123, tags: ["a"] });
    bad("commit tags 非陣列 → validation", { name: "N", tags: "a" });
    bad("commit tags 元素非字串 → validation", { name: "N", tags: [1, 2] });
    bad("commit rating 非數字(字串) → validation", { name: "N", tags: ["a"], rating: "5" });
    bad("commit rating 非數字(布林) → validation", { name: "N", tags: ["a"], rating: true });
    t.eq("垃圾 commit 一律不落地", db.imageCount(), 0);
  }

  // ── updateRecord：非物件 patch / expectedUpdatedAt 非數字 / 欄位型別垃圾 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const committed = m.commitRecord("a.png", { name: "A", tags: ["x"] }, FILE);
    const U = committed.data.updatedAt;

    // 非物件 patch 與 expectedUpdatedAt 非數字：在 not_found / stale 之前就被擋
    t.ok("update 非物件 patch(字串) → validation", isValidation(m.updateRecord("a.png", "nope")));
    t.ok("update 非物件 patch(null) → validation", isValidation(m.updateRecord("a.png", null)));
    t.ok("update expectedUpdatedAt 非數字 → validation", isValidation(m.updateRecord("a.png", { expectedUpdatedAt: "x" })));
    t.ok(
      "update expectedUpdatedAt 非有限數 → validation",
      isValidation(m.updateRecord("a.png", { expectedUpdatedAt: Infinity })),
    );
    // expectedUpdatedAt 缺失（undefined）也算非數字
    t.ok("update 缺 expectedUpdatedAt → validation", isValidation(m.updateRecord("a.png", { tags: ["y"] })));

    // 給正確 expectedUpdatedAt 後，欄位型別垃圾仍被擋
    t.ok("update tags 非陣列 → validation", isValidation(m.updateRecord("a.png", { expectedUpdatedAt: U, tags: 123 })));
    t.ok("update name 非字串 → validation", isValidation(m.updateRecord("a.png", { expectedUpdatedAt: U, name: 5 })));
    t.ok(
      "update rating 非數字 → validation",
      isValidation(m.updateRecord("a.png", { expectedUpdatedAt: U, rating: "3" })),
    );
    t.eq("垃圾 update 不改動真相", db.getImage("a.png").updatedAt, U);
  }

  // ── renameTag：oldName / newName 非字串 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    t.ok("rename oldName 非字串 → validation", isValidation(m.renameTag(123, "new")));
    t.ok("rename newName 非字串 → validation", isValidation(m.renameTag("old", 123)));
    t.ok("rename oldName null → validation", isValidation(m.renameTag(null, "new")));
    t.ok("rename 兩者皆非字串 → validation", isValidation(m.renameTag({}, [])));
  }

  // ── deleteTag：name 非字串 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    t.ok("delete name 非字串(數字) → validation", isValidation(m.deleteTag(123)));
    t.ok("delete name null → validation", isValidation(m.deleteTag(null)));
    t.ok("delete name 物件 → validation", isValidation(m.deleteTag({})));
  }

  // ── setTagMeta：name 非字串 / meta 型別垃圾 / hidden 非布林 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    t.ok("setTagMeta name 非字串 → validation", isValidation(m.setTagMeta(123, { hidden: true })));
    t.ok("setTagMeta meta 非物件(字串) → validation", isValidation(m.setTagMeta("cat", "nope")));
    t.ok("setTagMeta meta null → validation", isValidation(m.setTagMeta("cat", null)));
    t.ok("setTagMeta hidden 非布林(字串) → validation", isValidation(m.setTagMeta("cat", { hidden: "yes" })));
    t.ok("setTagMeta hidden 缺失 → validation", isValidation(m.setTagMeta("cat", {})));
    t.eq("垃圾 setTagMeta 不落地 metadata", db.getTagMeta("cat"), { hidden: false });
  }
}

export default { name, run };
