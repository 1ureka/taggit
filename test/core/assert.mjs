/**
 * @file core/assert.mjs
 * 極簡斷言器與輸出工具。與領域無關，任何 suite 都靠這一組把「測什麼」寫清楚。
 *
 * 慣例：每條斷言的 label 要能單獨說明「測什麼」，FAIL 時印出 got / want，
 * 不需回頭看程式碼就能看懂在驗證什麼。
 */

/** 直送 stdout，不受 console 靜音（見 core/loader.mjs）影響。 */
export function say(line = "") {
  process.stdout.write(line + "\n");
}

/**
 * 建立一個累計 pass/fail 的斷言器，回傳 { t, state }。
 * t 交給 suite 用（t.eq / t.ok / t.throws / t.notThrows）；state 由進入點彙總。
 */
export function createAsserter() {
  const state = { pass: 0, fail: 0, failures: [] };

  const record = (ok, label, detail) => {
    if (ok) {
      state.pass++;
      say(`  ✓ ${label}`);
    } else {
      state.fail++;
      state.failures.push(label);
      say(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
    }
  };

  const t = {
    /** JSON 深比較。比物件陣列請先投影成純量（如 .map(i => i.id)）。 */
    eq(label, got, want) {
      const g = JSON.stringify(got);
      const w = JSON.stringify(want);
      record(g === w, label, g === w ? "" : `got=${g} want=${w}`);
    },
    /** 布林斷言。 */
    ok(label, cond) {
      record(cond === true, label, cond === true ? "" : `got=${JSON.stringify(cond)} want=true`);
    },
    /** fn 必須拋錯。 */
    throws(label, fn) {
      let threw = false;
      try {
        fn();
      } catch {
        threw = true;
      }
      record(threw, label, threw ? "" : "expected throw, got none");
    },
    /** fn 不得拋錯。 */
    notThrows(label, fn) {
      let err = null;
      try {
        fn();
      } catch (e) {
        err = e;
      }
      record(err === null, label, err ? `threw: ${err?.message ?? err}` : "");
    },
  };

  return { t, state };
}
