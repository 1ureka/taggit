import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database, type ImageWithId } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  // 清單與抽選池需要完整篩選結果，一次取回（limit 0）；只有篩選變動、手動重整與取消提交會重跑本 load
  const base = ImageQuery.fromSearchParams(url.searchParams);
  const { items, total } = query.images(base.with({ list: base.list.with({ limit: 0 }) }));

  // 釘選畫布獨立於列表篩選：依 pinned 參數逐 id 解析（無視篩選條件），不存在的 id 靜默略過
  const pinnedParam = url.searchParams.get("pinned") ?? "";
  const pinnedRecords = pinnedParam
    .split(",")
    .filter(Boolean)
    .map((id) => query.getImage(id))
    .filter((rec): rec is ImageWithId => rec !== null);

  return { items, total, pinnedRecords };
};
