import fs from "fs";
import path from "path";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { getPaths } from "$lib/server/helpers.js";
import { getImage } from "$lib/server/thumbnail.js";
import { isValidArea, isValidFilename, isValidSize } from "$lib/server/validation.js";

export const GET: RequestHandler = async ({ params, url }) => {
  if (!getDB().isLoaded()) {
    return new Response("No collection loaded", { status: 503 });
  }

  const { area, file } = params;

  if (!isValidArea(area)) {
    return new Response("Invalid area", { status: 400 });
  }

  if (!isValidFilename(file)) {
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

  const sizeParam = url.searchParams.get("size") ?? "xl";
  if (!isValidSize(sizeParam)) {
    return new Response("Invalid size", { status: 400 });
  }

  try {
    const buffer = await getImage(area, file, filePath, sizeParam);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new Response("Failed to process image", { status: 500 });
  }
};
