/**
 * @file commands.ts
 * 命令參數型別
 */

import type { ImageRecord } from "$lib/poc/database";

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
