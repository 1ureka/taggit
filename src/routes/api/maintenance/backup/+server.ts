import fs from "fs";
import os from "os";
import path from "path";
import { execSync, execFileSync } from "child_process";
import { json, type RequestHandler } from "@sveltejs/kit";
import { requireDatabase } from "$lib/server/db-instance.js";

/** POST /api/maintenance/backup — create a ZIP backup of images/ + db.json and stream it as download */
export const POST: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  db.flush();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipPath = path.join(os.tmpdir(), `image-manager-backup-${timestamp}.zip`);

  try {
    if (process.platform === "win32") {
      const imagesArg = paths.images.replace(/'/g, "''");
      const dbArg = paths.db.replace(/'/g, "''");
      const zipArg = zipPath.replace(/'/g, "''");
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${imagesArg}','${dbArg}' -DestinationPath '${zipArg}' -Force"`,
        { timeout: 120_000 },
      );
    } else {
      execFileSync("zip", ["-r", zipPath, "images/", "db.json"], {
        cwd: paths.root,
        timeout: 120_000,
      });
    }

    const buffer = fs.readFileSync(zipPath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="backup-${timestamp}.zip"`,
      },
    });
  } catch {
    return json(
      {
        ok: false,
        error: "系統缺少壓縮工具或權限不足，無法建立備份。請手動備份 images/ 目錄與 db.json。",
      },
      { status: 500 },
    );
  } finally {
    try {
      fs.unlinkSync(zipPath);
    } catch {
      // ignore cleanup errors
    }
  }
};
