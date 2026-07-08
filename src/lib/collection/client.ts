/**
 * @file collection/client.ts
 * collection 模組的 client 端入口。
 *
 * 職責：collection 路徑歷史（使用者用過哪些 collection）的存取。
 * 目前以 localStorage 持久化；未來若改存 server.json，變更被封在本模組內。
 *
 * 模組外部只能 import 本檔與 {@link ./server.ts}。
 */

export {
  getCollectionPathHistory,
  pushCollectionPathHistory,
  clearCollectionPathHistory,
} from "./internal/path-history.js";

export type { CollectionPaths } from "./internal/structure.js";
