/**
 * @file server.ts
 * API 路由共用的伺服器端輔助函式，或不屬於任一業務模組的通用工具。
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { MutationError } from "$lib/poc/mutation";

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
 * 從 Request 解析 JSON body。
 * 成功時回傳 `[body, null]`，失敗時回傳 `[null, errorResponse]`。
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<[T, null] | [null, Response]> {
  try {
    const body = (await request.json()) as T;
    return [body, null];
  } catch {
    return [null, json({ ok: false, error: "無效的 JSON body" }, { status: 400 })];
  }
}

// ---

/** 把失敗的 mutation 結果對應到 HTTP 狀態碼。 */
function errorToHttp(error: MutationError): number {
  switch (error.kind) {
    case "not_found":
      return 404;
    case "stale_update":
      return 409;
    case "last_tag":
      return 409;
    case "validation":
      return 400;
  }
}

/** 把失敗的 mutation 結果組成統一的 JSON 錯誤回應 */
export function errorJson(error: MutationError): Response {
  return json({ ok: false, error }, { status: errorToHttp(error) });
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
