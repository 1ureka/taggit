import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { error, type RequestHandler } from "@sveltejs/kit";

import { Collection, type CollectionPaths } from "$lib/collection";
import { Database } from "$lib/database";
import { log } from "$lib/utils/server";

/**
 * 使用系統內建的壓縮工具將 images/ 目錄與 db.json 壓縮成 ZIP 檔
 */
const pack = (paths: CollectionPaths & { zip: string }) => {
  const timeout = 120_000;

  if (process.platform === "win32") {
    const imagesArg = paths.images.replace(/'/g, "''");
    const dbArg = paths.db.replace(/'/g, "''");
    const zipArg = paths.zip.replace(/'/g, "''");

    // 使用 execFileSync 直接啟動 powershell，避免路徑透過 cmd.exe shell 解析
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${imagesArg}','${dbArg}' -DestinationPath '${zipArg}' -Force`,
      ],
      { timeout },
    );
  } else {
    execFileSync("zip", ["-r", paths.zip, "images/", "db.json"], { cwd: paths.root, timeout });
  }
};

/**
 * `GET /api/collection/backup`
 *
 * 以 ZIP 形式取得整個圖片集（images/ 與 db.json）。
 * 是 GET 而非 POST：這只是圖片集的另一種表示，不在伺服器端建立任何資源。
 */
export const GET: RequestHandler = () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded()) error(503, "尚未載入圖片集");

  const paths = Collection.paths(root);
  Database.flush();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipPath = path.join(os.tmpdir(), `taggit-backup-${timestamp}.zip`);

  try {
    pack({ ...paths, zip: zipPath });

    const buffer = fs.readFileSync(zipPath);
    log({ level: "info", module: "collection/backup", message: `備份成功: backup-${timestamp}.zip` });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="backup-${timestamp}.zip"`,
      },
    });
  } catch (e) {
    log({ level: "error", module: "collection/backup", message: "備份失敗", data: { error: String(e) } });
    error(500, "系統缺少壓縮工具或權限不足，無法建立備份");
  } finally {
    try {
      fs.unlinkSync(zipPath);
    } catch {
      log({ level: "warn", module: "collection/backup", message: `無法刪除暫存備份檔案: ${zipPath}` });
    }
  }
};
