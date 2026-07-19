/**
 * @file operations.ts
 * 管理全頁操作鎖與重新整理或取消提交等操作
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/widgets/confirm-events";
import { getPinnedContext } from "./pinned.svelte";

class OperationsController {
  private pinned = getPinnedContext();

  /** 全局共用的操作鎖與指示 */
  pending = $state(false);

  /** 重新整理列表 */
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

  /** 退回指定 id 的圖片 */
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
