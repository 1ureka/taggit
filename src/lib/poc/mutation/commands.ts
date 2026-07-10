/**
 * @file commands.ts
 * 命令型別 —— 純輸入 DTO（各自獨立、不 parse URL、不組合）。
 * 型別編譯期抹除、跨前後端天然安全 → 不需獨立 args 模組。
 */

import type { ImageRecord } from "../database/index.js";

export interface ImportEntry {
  name: string;
  tags: string[];
  rating?: number;
}

export interface FileInfo {
  fileSize: number;
  width: number;
  height: number;
  blurhash: string;
}

export interface UpdatePatch {
  /** 呼叫端最後一次看到的 `updatedAt`，用於樂觀併發控制。 */
  expectedUpdatedAt: number;
  tags?: string[];
  rating?: number;
  name?: string;
}

export type FileMetaPatch = Partial<Pick<ImageRecord, "width" | "height" | "blurhash">>;
