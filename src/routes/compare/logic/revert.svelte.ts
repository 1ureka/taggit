/**
 * @file revert.svelte.ts
 * 管理已釘選圖片的取消提交（退回暫存區）操作
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";
import { getPinnedContext } from "./pinned.svelte";

class RevertController {
  private pinned = getPinnedContext();

  /** 是否有一次取消提交正在進行中 */
  pending = $state(false);

  /** 取消指定 id 圖片的提交 */
  handleRevert = async (id: string) => {
    if (this.pending) return;

    const msg = `確定要取消提交 ${id}？\n此操作會刪除圖片的名稱、評等與標籤，圖片本身則回到暫存區。`;
    if (!(await requestConfirm(msg, { title: "取消提交", action: "取消提交" }))) return;

    this.pending = true;
    try {
      const res = await api.del(`/api/records/${encodeURIComponent(id)}`);
      if (!res.ok) {
        addToast({ message: `取消提交失敗: ${res.error}`, variant: "error" });
        return;
      }

      this.pinned.handleUnpin(id);
      addToast({ message: `已取消提交：${id}`, variant: "info" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: "取消提交失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("revert-controller");

export const createRevertContext = () => {
  const controller = new RevertController();
  setContext(key, controller);
  return controller;
};

export const getRevertContext = () => getContext<RevertController>(key);
