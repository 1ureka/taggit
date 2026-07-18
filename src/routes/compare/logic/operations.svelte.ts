/**
 * @file operations.ts
 * /compare 全頁操作鎖：重新整理／取消提交，兩者互斥於同一個 `pending`。
 * `handleRevert` 成功後一併呼叫 `PinnedController.handleUnpin` 移除該 id、再重新整理資料；
 * 兩個非同步流程原本只包了 `finally`、沒有對應的 `catch`，例外會成為未處理的 rejection、
 * 使用者不會收到任何錯誤提示（見 issues/route_compare.md 第 6 條），這裡一併補上。
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/widgets/confirm-events";
import { getPinnedContext } from "./pinned.svelte";

class OperationsController {
  private pinned = getPinnedContext();

  pending = $state(false);

  handleRefresh = async () => {
    if (this.pending) return;

    this.pending = true;
    await new Promise((resolve) => setTimeout(resolve, 200)); // debounce

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true });
      addToast({ message: "列表已更新", variant: "success" });
    } catch (e) {
      addToast({ message: "重新整理失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.pending = false;
    }
  };

  handleRevert = async (id: string) => {
    if (this.pending) return;

    const msg = `確定要取消提交 ${id}？\n此操作會刪除圖片的名稱、評等與標籤，圖片本身則回到暫存區。`;
    if (!(await requestConfirm(msg, { title: "取消提交", action: "取消提交" }))) return;

    this.pending = true;
    try {
      const res = await api.del(`/api/committed/${encodeURIComponent(id)}`);
      if (!res.ok) {
        addToast({ message: "取消提交失敗" + (res.error ? `: ${res.error}` : ""), variant: "error" });
        return;
      }

      this.pinned.handleUnpin(id);
      addToast({ message: `已取消提交：${id}`, variant: "info" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true });
    } catch (e) {
      addToast({ message: "取消提交失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("operations-controller");

export const createOperationsContext = () => {
  const controller = new OperationsController();
  setContext(key, controller);
  return controller;
};

export const getOperationsContext = () => getContext<OperationsController>(key);
