/**
 * @file revert-mark.svelte.ts
 * 管理已提交圖片退回暫存的標記
 */

import { getContext, setContext } from "svelte";
import { getSnapshotsContext } from "./snapshots.svelte";

class RevertMarkController {
  private snapshots = getSnapshotsContext();

  /** 已標記退回的檔名集合 */
  private marks = $state<Record<string, true>>({});

  /** 已標記退回的檔名 */
  markedFiles = $derived(Object.keys(this.marks));

  /** 對指定檔名捨棄標記，應作為唯一方法，確保清除本地狀態與釋放，兩件事永遠一起發生 */
  private discard(filename: string) {
    if (!this.marks[filename]) return;
    delete this.marks[filename];
    this.snapshots.release(filename, "revert-mark");
  }

  /** 指定檔名是否已標記退回 */
  isMarked(filename: string): boolean {
    return filename in this.marks;
  }

  /** 指定檔名標記已知的內容，未標記時為 `undefined` */
  draftOf(filename: string) {
    return this.isMarked(filename) ? this.snapshots.peek(filename) : undefined;
  }

  /** 對指定檔名標記退回 */
  handleMark = (filenames: string[]) => {
    for (const f of filenames) {
      if (this.marks[f]) continue;
      this.snapshots.acquire(f, "revert-mark");
      this.marks[f] = true;
    }
  };

  /** 取消指定檔名的退回標記 */
  handleUnmark = (filenames: string[]) => {
    for (const f of filenames) this.discard(f);
  };

  /** 取消所有退回標記 */
  handleUnmarkAll = () => {
    for (const f of this.markedFiles) this.discard(f);
  };
}

const key = Symbol("revert-mark-controller");

export const createRevertMarkContext = () => {
  const controller = new RevertMarkController();
  setContext(key, controller);
  return controller;
};

export const getRevertMarkContext = () => getContext<RevertMarkController>(key);
