/**
 * @file server.ts
 * API 路由共用的伺服器端輔助函式，或不屬於任一業務模組的通用工具。
 */

import fs from "fs";
import path from "path";
import { error } from "@sveltejs/kit";
import { isRecord } from "$lib/utils/shared";
import type { MutationError } from "$lib/mutation";

/**
 * 在 `dir` 中為 `name` 找出不重複的檔名。
 * 若 `name` 已存在，會在副檔名前附加 `_1`、`_2`、……
 *
 * 範例：`photo.png` → `photo_1.png` → `photo_2.png` → …
 *
 * 只回傳檔名（不含完整路徑）。
 */
export function uniqueFilename(dir: string, name: string): string {
  const ext = path.extname(name);
  const raw = path.basename(name, ext);
  // Strip any existing _N suffix so we don't produce _1_1
  const match = raw.match(/^(.+?)_(\d+)$/);
  const stem = match ? match[1] : raw;

  if (!fs.existsSync(path.join(dir, name))) return name;

  let i = match ? Number(match[2]) + 1 : 1;
  while (true) {
    const candidate = `${stem}_${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
    i++;
  }
}

/**
 * 從 Request 解析 JSON body，失敗直接擲出 400。
 */
export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    error(400, "無效的 JSON body");
  }
}

/**
 * 從 Request 解析 JSON body 並確認它是純物件，失敗直接擲出 400。
 * 批次端點一律以 id 為鍵的物件當請求內容，共用這一道。
 */
export async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await parseJson(request);
  if (!isRecord(body)) error(400, "請求內容必須是物件");
  return body;
}

// ---

/**
 * 把失敗的 mutation 結果轉成人類可讀訊息。
 *
 * 這份對映的權威只有 `$lib/mutation` 的錯誤型別一個來源，因此收斂在此唯一一份；
 * 逐筆回報的批次端點直接用它填 `message`，單筆端點則走 {@link throwMutationError}。
 */
export function mutationMessage(e: MutationError): string {
  switch (e.kind) {
    case "not_found":
      return "找不到目標紀錄";
    case "already_exists":
      return "目標已存在，請重新整理後再試";
    case "stale_update":
      return "紀錄已被其他操作更新，請重新整理後再試";
    case "last_tag":
      return `有 ${e.images.length} 張圖片會因此失去最後一個標籤`;
    case "validation":
      return `${e.message}（欄位：${e.fields.join("、")}）`;
  }
}

/** 把失敗的 mutation 結果對應到 HTTP 狀態碼。 */
function mutationStatus(e: MutationError): number {
  switch (e.kind) {
    case "not_found":
      return 404;
    case "already_exists":
    case "stale_update":
    case "last_tag":
      return 409;
    case "validation":
      return 400;
  }
}

/** 把失敗的 mutation 結果轉成 HTTP 錯誤並擲出，body 恆為 `{ message }`。 */
export function throwMutationError(e: MutationError): never {
  error(mutationStatus(e), mutationMessage(e));
}

// ---

/**
 * 日誌條目
 */
type LogEntry = {
  level: "info" | "warn" | "error";
  module: string;
  message: string;
  data?: Record<string, unknown>;
};

/** ANSI 轉義字元 */
const escape = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  info: "\x1b[34m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  cyan: "\x1b[36m",
};

/** 在字串後補空白以達到指定長度 */
function pad(str: string, length: number) {
  if (str.length >= length) return str;
  return str + " ".repeat(length - str.length);
}

/** 格式化時間戳為 HH:MM:SS */
function formatTime(d: Date) {
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}

/**
 * 以結構化 JSON 格式印出日誌，包含時間戳、等級、模組、訊息和可選的額外資料。
 */
export function log(entry: Omit<LogEntry, "time">): void {
  const timeStr = escape.gray + formatTime(new Date()) + escape.reset;
  const levelStr = escape[entry.level] + pad(entry.level.toUpperCase(), 5) + escape.reset;
  const moduleStr = escape.cyan + pad(entry.module, 20) + escape.reset;
  const messageStr = entry.message;

  let output = `${timeStr} ${levelStr} ${moduleStr} ${messageStr}`;

  if (entry.data) {
    const dataStr = JSON.stringify(entry.data, null, 2);
    output += "\n" + escape.gray + dataStr + escape.reset;
  }

  console.log(output);
}
