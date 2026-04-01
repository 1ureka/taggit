import { goto } from "$app/navigation";
import { page } from "$app/state";
import type { ImageWithId } from "$lib/types.js";

type BrowseModalOptions = {
  get modalRecord(): ImageWithId | null;
};

export class BrowseModal {
  /** Modal 是否開啟 */
  open: boolean;
  /** 目前顯示的圖片紀錄 */
  record: ImageWithId;
  /** 根據 id 獲取其對應的 url */
  getHref: (id: string) => string;

  constructor(options: BrowseModalOptions) {
    this.open = $derived(options.modalRecord !== null);
    this.record = $derived(options.modalRecord!); // 因為 open 已經確保了 modalRecord 不為 null
    // 除非你不小心將其用在 modal 以外的地方

    this.getHref = $derived((id: string) => {
      const params = new URLSearchParams(page.url.searchParams);
      params.set("modal", id);
      return `/?${params.toString()}`;
    });
  }

  /** 關閉 Modal：從 URL 移除 ?modal */
  handleClose = () => {
    const params = new URLSearchParams(page.url.searchParams);
    params.delete("modal");
    const qs = params.toString();
    goto(`/${qs ? `?${qs}` : ""}`, { noScroll: true });
  };
}
