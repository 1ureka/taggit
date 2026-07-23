/**
 * @file snapshots.svelte.ts
 * 管理已提交圖片的原始快照共享儲存
 */

import { getContext, setContext } from "svelte";
import { getPageDataContext } from "./page-data.svelte";

/** 建立快照當下的原始內容 */
export type Snapshot = { name: string; rating: number; tags: string[]; updatedAt: number };

/** 會持有快照的角色 */
export type Owner = string;

class SnapshotsController {
  private pageData = getPageDataContext();

  /** 目前被至少一個持有者需要的快照 */
  private cache = $state<Record<string, Snapshot>>({});
  /** 每個檔名目前的持有者集合 */
  private holders = new Map<string, Set<Owner>>();

  private resolve(filename: string): Snapshot {
    const record = this.pageData.value.items.find((r) => r.id === filename);
    // acquire 應只會用目前可視清單內的 filename 呼叫
    if (!record) console.warn(`[snapshots] 未預期：${filename} 已不在目前可視清單內`);
    return record!;
  }

  /** 取得指定檔名的快照，並登記 owner 為持有者，第一個持有者才會真的向來源查詢並快取 */
  acquire(filename: string, owner: Owner): Snapshot {
    const holderSet = this.holders.get(filename) ?? new Set();
    holderSet.add(owner);
    this.holders.set(filename, holderSet);

    this.cache[filename] ??= this.resolve(filename);
    return this.cache[filename];
  }

  /** owner 不再需要這份快照；所有持有者都放手後刪除快照 */
  release(filename: string, owner: Owner) {
    const holderSet = this.holders.get(filename);
    if (!holderSet) return;

    holderSet.delete(owner);
    if (holderSet.size > 0) return;

    this.holders.delete(filename);
    delete this.cache[filename];
  }

  /** 查看指定檔名目前唯讀已知的內容，有快照時為快照內容，沒有時則是當下來源內容 */
  peek(filename: string): Readonly<Snapshot> {
    return this.cache[filename] ?? this.resolve(filename);
  }
}

const key = Symbol("snapshots-controller");

export const createSnapshotsContext = () => {
  const controller = new SnapshotsController();
  setContext(key, controller);
  return controller;
};

export const getSnapshotsContext = () => getContext<SnapshotsController>(key);
