/**
 * @file records-batch.suite.mjs
 * 集合層批次：以 id 為鍵的請求／回應是否完全對齊，`null` 是否等同對成員 DELETE，
 * 以及部分成功時失敗的那幾筆不會拖累其他筆。
 */

export const name = "api records 批次（keyed map + null 退回）";

export async function run(t, h) {
  const { api, call, collectStream, freshCollection, putImage, seedRecord, modules } = h;

  // ── POST 批次提交：結果鍵與請求鍵完全對齊 ──
  {
    freshCollection();
    await putImage("a.png");
    await putImage("b.png");

    const r = await call(api.records.POST, {
      body: {
        "a.png": { name: "阿爾法", tags: ["風景"] },
        "b.png": { name: "貝塔", tags: ["人像"], rating: 2 },
        "missing.png": { name: "不存在", tags: ["x"] },
      },
    });

    t.eq("回 200", r.status, 200);
    t.eq("回應的鍵 = 請求的鍵", Object.keys(r.body).toSorted(), ["a.png", "b.png", "missing.png"]);
    t.eq("成功筆數", Object.values(r.body).filter((x) => x.ok).length, 2);
    t.eq("失敗筆帶 message", r.body["missing.png"], { ok: false, message: "檔案不存在，可能已被移除" });

    const query = new modules.Query(modules.Database.requireLoaded());
    t.eq("成功的兩筆真的寫進去了", [query.hasImage("a.png"), query.hasImage("b.png")], [true, true]);
  }

  // ── POST 批次：一筆失敗不影響其他筆 ──
  {
    freshCollection();
    await putImage("a.png");
    await putImage("b.png");

    const r = await call(api.records.POST, {
      body: {
        "a.png": { name: "阿爾法", tags: [] }, // 標籤為空 → 驗證失敗
        "b.png": { name: "貝塔", tags: ["人像"] },
      },
    });

    t.eq("驗證失敗的那筆 ok=false", r.body["a.png"].ok, false);
    t.eq("同批的另一筆照樣成功", r.body["b.png"], { ok: true });
  }

  // ── PATCH 批次：物件 = 更新、null = 退回，兩者混在同一次請求 ──
  {
    freshCollection();
    const a = seedRecord("a.png", { name: "原名 A", updatedAt: 100 });
    seedRecord("b.png", { name: "原名 B", updatedAt: 200 });

    const r = await call(api.records.PATCH, {
      body: {
        "a.png": { name: "新名 A", expectedUpdatedAt: a.updatedAt },
        "b.png": null,
      },
    });

    t.eq("兩筆都成功", r.body, { "a.png": { ok: true }, "b.png": { ok: true } });

    const query = new modules.Query(modules.Database.requireLoaded());
    t.eq("物件那筆被更新", query.getImage("a.png").name, "新名 A");
    t.eq("null 那筆被退回", query.hasImage("b.png"), false);
  }

  // ── PATCH 批次：同一個 id 不可能有兩種操作（JSON 物件的鍵天生唯一）──
  {
    freshCollection();
    seedRecord("a.png", { name: "原名", updatedAt: 100 });

    // 手寫重複鍵的 JSON：JSON.parse 只會留下最後一個，端點看到的永遠是一筆
    const r = await call(api.records.PATCH, {
      body: '{"a.png":{"name":"先","expectedUpdatedAt":100},"a.png":null}',
    });

    t.eq("重複鍵只留下最後一個，結果也只有一筆", Object.keys(r.body), ["a.png"]);

    const query = new modules.Query(modules.Database.requireLoaded());
    t.eq("最後一個（null＝退回）生效，不會兩種操作都跑", query.hasImage("a.png"), false);
  }

  // ── PATCH 批次：樂觀併發逐筆獨立 ──
  {
    freshCollection();
    seedRecord("a.png", { updatedAt: 100 });
    seedRecord("b.png", { updatedAt: 200 });

    const r = await call(api.records.PATCH, {
      body: {
        "a.png": { name: "新 A", expectedUpdatedAt: 999 }, // 過期
        "b.png": { name: "新 B", expectedUpdatedAt: 200 },
      },
    });

    t.eq("過期的那筆失敗", r.body["a.png"], { ok: false, message: "紀錄已被其他操作更新，請重新整理後再試" });
    t.eq("沒過期的那筆成功", r.body["b.png"], { ok: true });
  }

  // ── PUT 批次：SSE 逐筆進度 + 覆寫語意 ──
  {
    freshCollection();
    await putImage("a.png");
    await putImage("b.png");
    seedRecord("a.png", { name: "舊的", tags: ["舊"] });

    const r = await call(api.records.PUT, {
      body: {
        "a.png": { name: "匯入 A", tags: ["新"] },
        "b.png": { name: "匯入 B", tags: ["新"] },
        "missing.png": { name: "不存在", tags: ["新"] },
      },
    });

    t.eq("回 text/event-stream", r.res.headers.get("content-type"), "text/event-stream");

    const events = await collectStream(r.res);
    const progress = events.filter((e) => e.event === "progress");
    const done = events.find((e) => e.event === "done");

    t.eq("每一筆都有一個 progress 事件", progress.length, 3);
    t.eq("progress 帶 id 與 current/total", { id: progress[0].id, current: progress[0].current, total: progress[0].total }, { id: "a.png", current: 1, total: 3 });
    t.eq("done 彙總成功與跳過", { imported: done.imported, skipped: done.skipped }, { imported: 2, skipped: 1 });
    t.eq("done 帶失敗原因", done.errors, ["missing.png: 檔案不存在，可能已被移除"]);

    const query = new modules.Query(modules.Database.requireLoaded());
    t.eq("已存在的紀錄被覆寫（PUT 是還原語意）", query.getImage("a.png").name, "匯入 A");
  }
}

export default { name, run };
