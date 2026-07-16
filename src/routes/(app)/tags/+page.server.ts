import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { TagQuery, TagWhere, ListOptions, type TagSort } from "$lib/query-spec";
import { PAGE_SIZE } from "./pool/pool";

export const load: PageServerLoad = () => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  // 只載入標籤池第 1 頁（預設查詢：universe=all、使用數降冪）；
  // 其後的搜尋/排序/顯隱/翻頁都是 client fetch GET /api/proto/tags-query，
  // 只有手動重整與送出變更集才會重跑本 load。
  const spec = new TagQuery(
    new TagWhere({ universe: "all" }),
    new ListOptions<TagSort>({ sort: "count", order: "desc", page: 1, limit: PAGE_SIZE }),
  );
  const { items: firstPage, total } = query.tags(spec);

  return { firstPage, total };
};
