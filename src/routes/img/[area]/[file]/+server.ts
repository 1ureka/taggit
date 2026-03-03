import fs from "fs";
import path from "path";
import { Readable } from "stream";
import type { RequestHandler } from "@sveltejs/kit";
import * as config from "$lib/server/config.js";
import * as db from "$lib/server/db.js";
import { MIME_TYPES } from "$lib/server/config.js";

const VALID_AREAS = new Set(["committed", "staged", "trash"]);

export const GET: RequestHandler = ({ params }) => {
  if (!db.isLoaded()) {
    return new Response("No collection loaded", { status: 503 });
  }

  const { area, file } = params;

  // Validate area
  if (!VALID_AREAS.has(area!)) {
    return new Response("Invalid area", { status: 400 });
  }

  // Validate file — must not contain path separators or traversal sequences
  if (!file || file.includes("/") || file.includes("\\") || file.includes("..") || file.startsWith(".")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const root = config.getCollectionRoot();
  if (!root) {
    return new Response("No collection configured", { status: 503 });
  }

  const paths = config.getCollectionPaths(root);
  const baseDir = paths[area as keyof typeof paths] as string;

  // Resolve and verify no path traversal escaped the base dir
  const filePath = path.resolve(baseDir, file);
  if (!filePath.startsWith(path.resolve(baseDir) + path.sep) && filePath !== path.resolve(baseDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(file).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

  // Cache-Control: committed images are immutable (content-addressed by hex ID)
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
