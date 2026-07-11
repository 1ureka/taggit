/**
 * @file ordinal.suite.mjs
 * OrdinalRegistry：序號指派、冪等、墓碑（序號不重用）、needsCompaction、live 位元圖、clear。
 */

export const name = "ordinal (OrdinalRegistry)";

export async function run(t, h) {
  const { OrdinalRegistry } = h.modules;

  // ── add 順序指派 + 冪等 ──
  {
    const reg = new OrdinalRegistry();
    t.eq("首個 add 得序號 0", reg.add("a"), 0);
    t.eq("次個 add 得序號 1", reg.add("b"), 1);
    t.eq("重複 add 同一 id 回既有序號（冪等）", reg.add("a"), 0);
    t.eq("liveCount 反映不重複 id 數", reg.liveCount, 2);
    t.eq("ordinalOf 對照", reg.ordinalOf("b"), 1);
    t.eq("idOf 對照", reg.idOf(0), "a");
    t.eq("ordinalOf 不存在回 undefined", reg.ordinalOf("z"), undefined);
    t.eq("idOf 超界回 null", reg.idOf(99), null);
  }

  // ── remove 留墓碑，序號不重用 ──
  {
    const reg = new OrdinalRegistry();
    reg.add("a"); // 0
    reg.add("b"); // 1
    t.eq("remove 回傳其序號", reg.remove("a"), 0);
    t.eq("remove 後 idOf 該序號為 null（墓碑）", reg.idOf(0), null);
    t.eq("remove 後 ordinalOf 為 undefined", reg.ordinalOf("a"), undefined);
    t.eq("remove 後 liveCount 遞減", reg.liveCount, 1);
    t.eq("remove 不存在 id 回 undefined", reg.remove("z"), undefined);
    // 新 id 拿下一個序號 2，不重用墓碑 0
    t.eq("後續 add 不重用墓碑序號", reg.add("c"), 2);
  }

  // ── live 位元圖反映存活集合 ──
  {
    const reg = new OrdinalRegistry();
    reg.add("a"); // 0
    reg.add("b"); // 1
    reg.add("c"); // 2
    reg.remove("b"); // 墓碑 1
    t.eq("live 位元圖排除墓碑序號", [...reg.live.values()], [0, 2]);
  }

  // ── needsCompaction：墓碑數 > 存活數 ──
  {
    const reg = new OrdinalRegistry();
    ["a", "b", "c"].forEach((id) => reg.add(id));
    reg.remove("a");
    reg.remove("b"); // 墓碑2 存活1
    t.ok("墓碑(2) > 存活(1) → needsCompaction", reg.needsCompaction);

    const reg2 = new OrdinalRegistry();
    ["a", "b", "c"].forEach((id) => reg2.add(id));
    reg2.remove("a"); // 墓碑1 存活2
    t.ok("墓碑(1) ≤ 存活(2) → 不需壓實", reg2.needsCompaction === false);
  }

  // ── clear 全重置 ──
  {
    const reg = new OrdinalRegistry();
    reg.add("a");
    reg.add("b");
    reg.remove("a");
    reg.clear();
    t.eq("clear 後 liveCount 歸零", reg.liveCount, 0);
    t.eq("clear 後 live 位元圖為空", [...reg.live.values()], []);
    t.eq("clear 後序號從 0 重新指派", reg.add("x"), 0);
    t.ok("clear 後不需壓實", reg.needsCompaction === false);
  }
}

export default { name, run };
