/**
 * @file resources.suite.mjs
 * LRUCache（位元組上限淘汰、LRU 順序、覆寫扣抵、clear、stats）與
 * TaskPool（併發上限、排隊、drain、reject 不卡池）。純記憶體，零 I/O。
 */

export const name = "resources (LRUCache / TaskPool)";

/** 產生一個指定 byteLength 的 Buffer。 */
const buf = (n) => Buffer.alloc(n);

/** 手動控制 resolve/reject 時機的 deferred，用來精確斷言 TaskPool 執行順序。 */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function run(t, h) {
  const { LRUCache, TaskPool } = h.modules;

  // ── LRUCache：基本 set / get ──
  {
    const c = new LRUCache(1000);
    c.set("a", buf(10));
    t.ok("set 後 get 命中回傳 Buffer", Buffer.isBuffer(c.get("a")));
    t.eq("get 未存在的 key 回 undefined", c.get("z"), undefined);
    t.eq("stats 反映項目數與位元組數", c.stats, { entries: 1, bytes: 10 });
  }

  // ── LRUCache：超過 maxBytes 觸發淘汰，淘汰最舊未存取項目 ──
  {
    const c = new LRUCache(30);
    c.set("a", buf(10));
    c.set("b", buf(10));
    c.set("c", buf(10)); // 剛好 30，未超過
    t.eq("未超過上限時三筆都在", c.stats.entries, 3);
    c.set("d", buf(10)); // 40 > 30 → 淘汰最舊的 a
    t.eq("超過上限淘汰後仍為 3 筆", c.stats.entries, 3);
    t.eq("被淘汰的是最舊項目 a", c.get("a"), undefined);
    t.ok("較新的 d 仍在", Buffer.isBuffer(c.get("d")));
  }

  // ── LRUCache：get 會更新 LRU 順序（最近存取者免於淘汰）──
  {
    const c = new LRUCache(30);
    c.set("a", buf(10));
    c.set("b", buf(10));
    c.set("c", buf(10));
    c.get("a"); // a 移到最新，b 變成最舊
    c.set("d", buf(10)); // 淘汰最舊者 b
    t.ok("被存取過的 a 免於淘汰", Buffer.isBuffer(c.get("a")));
    t.eq("最舊的 b 被淘汰", c.get("b"), undefined);
  }

  // ── LRUCache：覆寫同 key 先扣舊 byteSize 再累加 ──
  {
    const c = new LRUCache(1000);
    c.set("a", buf(10));
    c.set("a", buf(25)); // 覆寫
    t.eq("覆寫同 key 不增加項目數", c.stats.entries, 1);
    t.eq("覆寫同 key 正確重算位元組數", c.stats.bytes, 25);
  }

  // ── LRUCache：clear 歸零 ──
  {
    const c = new LRUCache(1000);
    c.set("a", buf(10));
    c.set("b", buf(20));
    c.clear();
    t.eq("clear 後 stats 歸零", c.stats, { entries: 0, bytes: 0 });
    t.eq("clear 後 get 回 undefined", c.get("a"), undefined);
  }

  // ── TaskPool：未達 concurrency 立即執行 ──
  {
    const pool = new TaskPool(2);
    const order = [];
    const results = await Promise.all([
      pool.enqueue(async () => {
        order.push("a");
        return 1;
      }),
      pool.enqueue(async () => {
        order.push("b");
        return 2;
      }),
    ]);
    t.eq("回傳各任務的結果", results, [1, 2]);
    t.eq("兩個任務都有執行", order.sort(), ["a", "b"]);
  }

  // ── TaskPool：超過 concurrency 時排隊，前者完成才啟動後者 ──
  {
    const pool = new TaskPool(1); // 併發 1，強制序列化
    const d1 = deferred();
    const started = [];

    const p1 = pool.enqueue(async () => {
      started.push("t1");
      return d1.promise;
    });
    const p2 = pool.enqueue(async () => {
      started.push("t2");
      return "done2";
    });

    // 讓 microtask 跑一輪：t1 應已啟動，t2 因為併發滿而仍在排隊
    await Promise.resolve();
    t.eq("併發滿時第二個任務尚未啟動", started, ["t1"]);

    d1.resolve("done1");
    const r1 = await p1;
    const r2 = await p2;
    t.eq("第一個任務完成後啟動第二個", started, ["t1", "t2"]);
    t.eq("兩個任務結果正確", [r1, r2], ["done1", "done2"]);
  }

  // ── TaskPool：任務 reject 不會卡住 pool（後續任務仍會執行）──
  {
    const pool = new TaskPool(1);
    let secondRan = false;

    const p1 = pool.enqueue(async () => {
      throw new Error("boom");
    });
    const p2 = pool.enqueue(async () => {
      secondRan = true;
      return "ok";
    });

    let rejected = false;
    try {
      await p1;
    } catch {
      rejected = true;
    }
    const r2 = await p2;
    t.ok("失敗任務的 promise 確實 reject", rejected);
    t.ok("前一個任務 reject 後仍執行下一個", secondRan);
    t.eq("下一個任務結果正常", r2, "ok");
  }
}

export default { name, run };
