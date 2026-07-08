/**
 * @file store.ts
 * Database —— 記憶體內資料庫的狀態持有者與持久化。
 *
 * 本類別的職責：
 *   - 擁有所有記憶體內狀態（資料、序號、位元圖索引、dirty 旗標）。
 *   - 防抖寫入 db.json 至磁碟（原子性 `.tmp` 重新命名）。
 *   - 載入 / 切換 db.json 檔案；載入即整體重建索引。
 *
 * 本模組不知道 collection 根目錄的概念 —— 只認得「一個 db.json 檔案路徑」。
 * 單例管理與公開介面位於 {@link ../server.ts}。
 */

import fs from "fs";
import { formatError } from "$lib/utils/shared.js";
import { log } from "$lib/utils/server.js";
import { OrdinalRegistry } from "./ordinal.js";
import { FacetIndex } from "./facet-index.js";
import { emptyDBData, parseDBData } from "./schema.js";
import type { DBData, ImageRecord } from "./types.js";

export class Database {
  /** 原始資料庫內容，映射磁碟上 db.json 的結構。 */
  data: DBData;

  /** ID ↔ 序號的映射（純記憶體）。 */
  ordinals: OrdinalRegistry;

  /** 標籤 / 評分位元圖索引（純衍生資料）。 */
  facets: FacetIndex;

  /** 記憶體內狀態是否與上次持久化快照不同。 */
  dirty: boolean;

  /** 防抖寫入計時器的控制代碼，閒置時為 `null`。 */
  flushTimer: ReturnType<typeof setTimeout> | null;

  /** 目前載入的 db.json 絕對路徑，或 `null`。 */
  currentDbPath: string | null;

  /** db.json 成功載入後為 `true`。 */
  loaded: boolean;

  constructor() {
    this.data = emptyDBData();
    this.ordinals = new OrdinalRegistry();
    this.facets = new FacetIndex();
    this.dirty = false;
    this.flushTimer = null;
    this.currentDbPath = null;
    this.loaded = false;
  }

  // ---

  /**
   * 使用目前的 {@link data} 快照，從頭重建序號與全部位元圖。
   * 載入、壓實與所有批次異動（rename / delete tag、匯入完成）後的統一收斂點。
   */
  rebuildIndexes(): void {
    this.ordinals.clear();
    this.facets.clear();
    for (const [id, rec] of Object.entries(this.data.images)) {
      const ordinal = this.ordinals.add(id);
      this.facets.add(ordinal, rec);
    }
  }

  /**
   * 將單筆紀錄加入序號與位元圖索引，回傳其序號。
   */
  indexAdd(id: string, rec: ImageRecord): number {
    const ordinal = this.ordinals.add(id);
    this.facets.add(ordinal, rec);
    return ordinal;
  }

  /**
   * 將單筆紀錄自序號與位元圖索引移除（留下墓碑）。
   * 墓碑超過門檻時自動壓實（整體重建）。
   */
  indexRemove(id: string, rec: ImageRecord): void {
    const ordinal = this.ordinals.remove(id);
    if (ordinal !== undefined) {
      this.facets.remove(ordinal, rec);
    }

    if (this.ordinals.needsCompaction) {
      this.rebuildIndexes();
    }
  }

  /**
   * 回傳目前被標記為 hidden 的標籤名稱列表。
   */
  hiddenTagNames(): string[] {
    const names: string[] = [];
    for (const [name, meta] of Object.entries(this.data.tags)) {
      if (meta.hidden === true) names.push(name);
    }
    return names;
  }

  // ---

  /**
   * 將資料庫標記為有未儲存的變更，並排程在 500 毫秒後防抖寫入磁碟。
   * 先前排定的寫入會被取消並重新排程。
   */
  markDirty(): void {
    this.dirty = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 500);
  }

  /**
   * 透過原子性的 `.tmp` 檔案重新命名，將目前的 {@link data} 快照寫入 db.json。
   * 成功後清除 dirty 旗標。
   *
   * 當資料庫非 dirty 或沒有 {@link currentDbPath} 時呼叫此方法是安全的空操作。
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty || !this.currentDbPath) return;

    const tmp = this.currentDbPath + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmp, this.currentDbPath);
      this.dirty = false;
      log({ level: "info", module: "database", message: `已寫入至 ${this.currentDbPath}` });
    } catch (e) {
      log({ level: "error", module: "database", message: `寫入至磁碟失敗: ${formatError(e)}` });
    }
  }

  // ---

  /**
   * 先寫入所有待處理的變更，再載入位於 `dbPath` 的 db.json。
   * 若主檔案不存在但有 `.tmp` 復原檔，則自動升格使用。
   * 若資料庫完全不存在，則以全新狀態開始並立即標記為 dirty 以便持久化。
   *
   * @param dbPath - db.json 的絕對路徑。
   */
  loadCollection(dbPath: string): void {
    this.flush();

    this.currentDbPath = dbPath;
    this.loaded = false;
    this.data = emptyDBData();

    const tmp = dbPath + ".tmp";

    // 復原：若主資料庫不存在，優先使用 .tmp
    if (!fs.existsSync(dbPath) && fs.existsSync(tmp)) {
      log({ level: "warn", module: "database", message: "主資料庫不存在，正在從 .tmp 復原…" });
      fs.renameSync(tmp, dbPath);
    }

    if (fs.existsSync(dbPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        this.data = parseDBData(parsed);
        log({
          level: "info",
          module: "database",
          message: `已載入 ${Object.keys(this.data.images).length} 張已提交圖片紀錄`,
        });
      } catch (e) {
        log({ level: "error", module: "database", message: `載入資料庫失敗，將以全新狀態開始: ${formatError(e)}` });
        this.data = emptyDBData();
        this.markDirty();
      }
    } else {
      log({ level: "info", module: "database", message: "未找到現有的 db.json ，將以全新狀態開始" });
      this.markDirty();
    }

    this.rebuildIndexes();
    this.loaded = true;
  }

  /**
   * 當 db.json 已載入且資料庫可供查詢時回傳 `true`。
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}
