/**
 * @file db.ts
 * 記憶體內 JSON 資料庫 —— 類別定義與持久化。
 *
 * 本模組的職責：
 *   - {@link JSONDatabase} 類別：擁有所有記憶體內狀態（資料、索引、dirty 旗標）。
 *   - 防抖寫入 `db.json` 至磁碟。
 *   - 載入 / 切換目前的集合。
 *
 * 單例管理與存取介面位於 {@link ./db-instance.ts}。
 * 查詢邏輯位於 {@link ./db-query.ts}。
 * 異動邏輯位於 {@link ./db-mutation.ts}。
 * 業務邏輯應透過 `db-instance.ts` 的 `requireDatabase` / `requirePaths` 取得 db 與 paths。
 */

import fs from "fs";
import { getCollectionPaths } from "./config.js";
import { formatError } from "$lib/utils.js";
import type { DBData, ImageRecord } from "$lib/types.js";

/**
 * 封裝圖片資料庫的所有記憶體內狀態，以及索引維護與持久化邏輯。
 *
 * 實例通常透過 {@link ./db-instance.ts} 的 `requireDatabase` 取得，
 * 而非直接建構。
 */
export class JSONDatabase {
  /** 原始資料庫內容，映射磁碟上 `db.json` 的結構。 */
  data: DBData;

  /** 倒排索引：標籤名稱 → 擁有該標籤的圖片 ID 集合。 */
  tagIndex: Map<string, Set<string>>;

  /** 記憶體內狀態是否與上次持久化快照不同。 */
  dirty: boolean;

  /** 防抖寫入計時器的控制代碼，閒置時為 `null`。 */
  flushTimer: ReturnType<typeof setTimeout> | null;

  /** 目前載入的集合根目錄絕對路徑，或 `null`。 */
  currentRoot: string | null;

  /** 集合成功載入後為 `true`。 */
  loaded: boolean;

  /** 將所有欄位初始化為安全的空預設值。 */
  constructor() {
    this.data = { version: 1, images: {} };
    this.tagIndex = new Map();
    this.dirty = false;
    this.flushTimer = null;
    this.currentRoot = null;
    this.loaded = false;
  }

  // ---

  /**
   * 使用目前的 {@link data} 快照從頭重建標籤索引。
   * 當增量修改已不切實際時（例如大量圖片變更或初始載入）呼叫此方法。
   */
  buildIndexes(): void {
    this.tagIndex.clear();
    for (const [id, rec] of Object.entries(this.data.images)) {
      this.indexAdd(id, rec);
    }
  }

  /**
   * 將單一圖片記錄加入標籤索引。
   *
   * @param id - 圖片識別碼。
   * @param rec - 需要被索引其標籤的圖片記錄。
   */
  indexAdd(id: string, rec: ImageRecord): void {
    for (const tag of rec.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(id);
    }
  }

  /**
   * 從標籤索引中移除單一圖片記錄。
   * 空的索引桶會自動清除。
   *
   * @param id - 圖片識別碼。
   * @param rec - 要從索引中移除的圖片記錄。
   */
  indexRemove(id: string, rec: ImageRecord): void {
    for (const tag of rec.tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.tagIndex.delete(tag);
      }
    }
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
   * 透過原子性的 `.tmp` 檔案重新命名，將目前的 {@link data} 快照寫入 `db.json`。
   * 成功後清除 dirty 旗標。
   *
   * 當資料庫非 dirty 或沒有 `currentRoot` 時呼叫此方法是安全的空操作。
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty || !this.currentRoot) return;

    const dbPath = getCollectionPaths(this.currentRoot).db;
    const tmp = dbPath + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tmp, dbPath);
      this.dirty = false;
      console.log("[db] Flushed");
    } catch (e) {
      console.error("[db] Flush error:", formatError(e));
    }
  }

  // ---

  /**
   * 先寫入所有待處理的變更，再載入位於 `rootPath` 的 `db.json`。
   * 若主檔案不存在但有 `.tmp` 復原檔，則自動升格使用。
   * 若資料庫完全不存在，則以全新狀態開始並立即標記為 dirty 以便持久化。
   *
   * @param rootPath - 集合根目錄的絕對路徑。
   */
  loadCollection(rootPath: string): void {
    this.flush();

    this.currentRoot = rootPath;
    this.loaded = false;
    this.data = { version: 1, images: {} };

    const dbPath = getCollectionPaths(rootPath).db;
    const tmp = dbPath + ".tmp";

    // 復原：若主資料庫不存在，優先使用 .tmp
    if (!fs.existsSync(dbPath) && fs.existsSync(tmp)) {
      console.log("[db] Recovering from tmp file");
      fs.renameSync(tmp, dbPath);
    }

    if (fs.existsSync(dbPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        this.data.version = parsed.version ?? 1;
        this.data.images = parsed.images ?? {};
        console.log(`[db] Loaded: ${Object.keys(this.data.images).length} images`);
      } catch (e) {
        console.error("[db] Load error, starting fresh:", formatError(e));
        this.data = { version: 1, images: {} };
        this.markDirty();
      }
    } else {
      console.log("[db] No existing db.json, starting fresh");
      this.markDirty();
    }

    this.buildIndexes();
    this.loaded = true;
  }

  /**
   * 當集合已載入且資料庫可供查詢時回傳 `true`。
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * 回傳目前使用中的集合根目錄絕對路徑，
   * 若尚未載入任何集合則回傳 `null`。
   */
  getCurrentRoot(): string | null {
    return this.currentRoot;
  }
}
