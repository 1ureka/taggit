import fs from "fs";
import path from "path";
import { Readable } from "stream";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { MIME_TYPES } from "$lib/server/config.js";
import { getPaths } from "$lib/server/helpers.js";

const VALID_AREAS = new Set(["committed", "staged", "trash"]);

export const GET: RequestHandler = ({ params }) => {
  if (!getDB().isLoaded()) {
    return new Response("No collection loaded", { status: 503 });
  }

  const { area, file } = params;

  if (!VALID_AREAS.has(area!)) {
    return new Response("Invalid area", { status: 400 });
  }

  if (!file || file.includes("/") || file.includes("\\") || file.includes("..") || file.startsWith(".")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const paths = getPaths();
  const baseDir = paths[area as keyof typeof paths] as string;

  const filePath = path.resolve(baseDir, file);
  if (!filePath.startsWith(path.resolve(baseDir) + path.sep) && filePath !== path.resolve(baseDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(file).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";
  const cacheControl = area === "committed" ? "public, max-age=86400" : "no-cache, no-store, must-revalidate";

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl,
    },
  });
};
