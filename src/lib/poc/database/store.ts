/**
 * @file store.ts
 * class Database —— authority-free 引擎，同時扛兩層（皆在此 class 內，無 module-level 裸函式）：
 *
 *   靜態層 = 單例生命週期：唯一碰 `globalThis` 單例的地方；route / hooks 從這裡取 db。
 *   實例層 = authority-free 原語：query / mutation 只認建構子傳入的實例，不碰靜態單例。
 *
 * 三組實例原語（見 plan-db/database.md）：
 *   A. 真相 CRUD —— 對稱、完整型別、覆寫語意（image by id / tagMeta by name）。
 *   B. 索引 —— 與真相 CRUD 分開（indexAdd/indexRemove/rebuild）。
 *   C. 投影查詢 —— 唯讀（tagBits / ratingRange / live / idOf / …）。
 *
 * 高階動作（resolveScope、read-overlay-write 合併、批次遍歷）不在此，由 query / mutation 組合。
 */

import fs from "fs";
import { formatError } from "$lib/utils/shared.js";
import { log } from "$lib/utils/server.js";
import { BitSet } from "./bitmap.js";
import { OrdinalRegistry } from "./ordinal.js";
import { FacetIndex } from "./facet-index.js";
import { emptyDBData, parseDBData, TagMetaCodec } from "./serialization.js";
import type { DBData, ImageRecord, TagMeta } from "./types.js";

declare global {
  /** HMR 保護：在熱重載之間重用現有的 {@link Database} 實例。 */
  // eslint-disable-next-line no-var
  var __pocDb: Database | undefined;
}

export class Database {
  // ── 靜態：單例生命週期（唯一碰 globalThis 單例處）──────────────

  /** 取模組層級單例，首次存取時建立；存於 `globalThis` 以扛 Vite HMR。 */
  private static singleton(): Database {
    if (!globalThis.__pocDb) globalThis.__pocDb = new Database();
    return globalThis.__pocDb;
  }

  /**
   * 取用口：回已載入的實例。not-load 由 route 頂端守衛負責回應；
   * 此處拿不到 = route 沒守好的 bug → throw 到框架邊界。
   */
  static requireLoaded(): Database {
    const db = Database.singleton();
    if (!db.loaded) throw new Error("database 尚未載入（route 應先以 Database.isLoaded() 守衛）");
    return db;
  }

  /**
   * 確保單例已載入指定 db.json：未載入或目前綁定的是其他檔案時載入，否則 no-op。
   * 供 hooks 每個 request 前呼叫。靜態方法與實例同屬本 class body，
   * 可直接讀私有 {@link filePath} 做比對 → 故 `filePath` 全私有、無 getter。
   */
  static ensureLoaded(dbPath: string): void {
    const db = Database.singleton();
    if (!db.loaded || db.filePath !== dbPath) db.load(dbPath);
  }

  /** 單例是否已載入且可供查詢。 */
  static isLoaded(): boolean {
    return Database.singleton().loaded;
  }

  /**
   * 立即將所有待處理變更寫入磁碟（供 hooks 關閉訊號 / 備份前）。
   * 未載入或無變更時為安全的空操作。
   */
  static flush(): void {
    Database.singleton().flush();
  }

  // ── 實例：私有狀態 ─────────────────────────────────────────

  /** 兩份真相，映射磁碟上 db.json 的結構。 */
  private data: DBData = emptyDBData();
  /** ID ↔ 序號的映射（投影，純記憶體）。 */
  private ordinals = new OrdinalRegistry();
  /** 標籤 / 評分位元圖索引（投影，純衍生）。 */
  private facets = new FacetIndex();
  /** 記憶體內狀態是否與上次持久化快照不同。 */
  private dirty = false;
  /** 防抖寫入計時器控制代碼，閒置為 `null`。 */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** 綁定的 db.json 絕對路徑（**唯一一個路徑欄位**，全私有、無 getter），或 `null`。 */
  private filePath: string | null = null;
  /** db.json 成功載入後為 `true`。 */
  private loaded = false;

  // ── 原語 A：真相 CRUD（images by id）—— dumb 覆寫，不碰投影 ──

  /** 取單筆完整紀錄；缺席回 `null`。不含 id（id 是身份，由呼叫端組裝）。 */
  getImage(id: string): ImageRecord | null {
    return this.data.images[id] ?? null;
  }

  /** 覆寫單筆完整紀錄（呼叫端組好完整 {@link ImageRecord}）。只寫真相 slot、不碰投影。 */
  setImage(id: string, rec: ImageRecord): void {
    this.data.images[id] = rec;
  }

  /** 刪除單筆真相 slot。不碰投影。 */
  deleteImage(id: string): void {
    delete this.data.images[id];
  }

  /** 是否存在指定 id 的真相。 */
  hasImage(id: string): boolean {
    return id in this.data.images;
  }

  /** 真相中的圖片總數。 */
  imageCount(): number {
    return Object.keys(this.data.images).length;
  }

  /** 迭代全部真相（id, record）。供維護掃描 / 全量 dump 用。 */
  imageEntries(): [string, ImageRecord][] {
    return Object.entries(this.data.images);
  }

  // ── 原語 A：真相 CRUD（tagMeta by name）—— 介面對稱、實作做 hydrate/prune ──

  /** 取完整 {@link TagMeta}；缺席鍵回 hydrate 後的完整預設值（永遠回完整）。 */
  getTagMeta(name: string): TagMeta {
    return TagMetaCodec.hydrate(this.data.tags[name]);
  }

  /** 覆寫完整 {@link TagMeta}；內部 prune 存稀疏，全預設則移除表項。 */
  setTagMeta(name: string, meta: TagMeta): void {
    const pruned = TagMetaCodec.prune(meta);
    if (pruned) this.data.tags[name] = pruned;
    else delete this.data.tags[name];
  }

  /** 刪除標籤元資料的真相 slot。 */
  deleteTagMeta(name: string): void {
    delete this.data.tags[name];
  }

  /** 迭代所有「有非預設元資料」的標籤名（用於 universe="all" 併入未使用標籤）。 */
  tagMetaNames(): string[] {
    return Object.keys(this.data.tags);
  }

  // ── 原語 B：索引（與真相 CRUD 分開；mutation 寫真相後組合它們）──

  /** 將單筆紀錄加入序號與位元圖索引，回傳其序號。 */
  indexAdd(id: string, rec: ImageRecord): number {
    const ordinal = this.ordinals.add(id);
    this.facets.add(ordinal, rec);
    return ordinal;
  }

  /**
   * 將單筆紀錄自序號與位元圖索引移除（留下墓碑）。墓碑超門檻時自動壓實（整體重建）。
   */
  indexRemove(id: string, rec: ImageRecord): void {
    const ordinal = this.ordinals.remove(id);
    if (ordinal !== undefined) this.facets.remove(ordinal, rec);
    if (this.ordinals.needsCompaction) this.rebuild();
  }

  /**
   * 以目前的真相快照，從頭重建序號與全部位元圖。
   * 「索引純由 images 單向推導」這個契約本身；載入、壓實與批次異動後的統一收斂點。
   */
  rebuild(): void {
    this.ordinals.clear();
    this.facets.clear();
    for (const [id, rec] of Object.entries(this.data.images)) {
      const ordinal = this.ordinals.add(id);
      this.facets.add(ordinal, rec);
    }
  }

  // ── 原語 C：投影查詢（唯讀）──────────────────────────────

  /** 指定標籤的位元圖，不存在時為 `null`。 */
  tagBits(name: string): BitSet | null {
    return this.facets.getTagBits(name) ?? null;
  }

  /** 迭代所有「目前被使用」的標籤 → 位元圖。 */
  tagBitsEntries(): IterableIterator<[string, BitSet]> {
    return this.facets.tagBits.entries();
  }

  /** 評分區間 `[from, to]`（含端點）的聯集位元圖。 */
  ratingRange(from: number, to: number): BitSet {
    return this.facets.ratingRange(from, to);
  }

  /** 目前存活的序號全集。呼叫端需 clone 後才能改動。 */
  get live(): BitSet {
    return this.ordinals.live;
  }

  /** 序號 → id，墓碑 / 超界回 `null`。 */
  idOf(ordinal: number): string | null {
    return this.ordinals.idOf(ordinal);
  }

  /** id → 序號，不存在回 `undefined`。 */
  ordinalOf(id: string): number | undefined {
    return this.ordinals.ordinalOf(id);
  }

  /** 目前被標記為 hidden 的標籤名稱列表。 */
  hiddenTagNames(): string[] {
    const names: string[] = [];
    for (const [name, meta] of Object.entries(this.data.tags)) {
      if (meta.hidden === true) names.push(name);
    }
    return names;
  }

  // ── 索引維護後的 dirty / 持久化 ─────────────────────────────

  /**
   * 標記有未儲存變更，並排程 500ms 後防抖寫入。先前排定的寫入會被取消重排。
   */
  markDirty(): void {
    this.dirty = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 500);
  }

  /**
   * 透過原子性 `.tmp` 重新命名寫入 db.json，成功後清 dirty。
   * 非 dirty 或未綁定路徑時為安全的空操作。
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty || !this.filePath) return;

    const tmp = this.filePath + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmp, this.filePath);
      this.dirty = false;
      log({ level: "info", module: "database", message: `已寫入至 ${this.filePath}` });
    } catch (e) {
      log({ level: "error", module: "database", message: `寫入至磁碟失敗: ${formatError(e)}` });
    }
  }

  /**
   * 先寫入所有待處理變更，再載入位於 `dbPath` 的 db.json（私有；由靜態 ensureLoaded 觸發）。
   * 主檔不存在但有 `.tmp` 復原檔則自動升格；完全不存在則以全新狀態開始並立即標髒。
   */
  private load(dbPath: string): void {
    this.flush();

    this.filePath = dbPath;
    this.loaded = false;
    this.data = emptyDBData();

    const tmp = dbPath + ".tmp";

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

    this.rebuild();
    this.loaded = true;
  }
}
