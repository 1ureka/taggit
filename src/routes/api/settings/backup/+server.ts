import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { json, type RequestHandler } from "@sveltejs/kit";

import type { CollectionPaths } from "$lib/types";
import { requireDatabase } from "$lib/server/db-instance.js";
import { log } from "$lib/server/helpers";

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
 * `POST /api/settings/backup`
 *
 * 建立 images/ 與 db.json 的 ZIP 備份並下載。
 */
export const POST: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const { db, paths } = loaded;
  db.flush();

  // ---

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipPath = path.join(os.tmpdir(), `image-manager-backup-${timestamp}.zip`);

  try {
    pack({ ...paths, zip: zipPath });

    const buffer = fs.readFileSync(zipPath);
    const headers: HeadersInit = {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="backup-${timestamp}.zip"`,
    };

    return new Response(buffer, { headers });

    // ---
  } catch {
    return json({ ok: false, error: "系統缺少壓縮工具或權限不足，無法建立備份。" }, { status: 500 });
  } finally {
    try {
      fs.unlinkSync(zipPath);
    } catch {
      log({ level: "warn", module: "api/settings/backup", message: `無法刪除暫存備份檔案: ${zipPath}` });
    }
  }
};
