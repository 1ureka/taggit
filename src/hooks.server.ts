import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit";
import * as config from "$lib/server/config.js";
import { getDB } from "$lib/server/db.js";

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// Flush the in-memory DB to disk when the process receives SIGINT (Ctrl-C).
// Only register once (HMR-safe via a globalThis flag).

declare global {
  // eslint-disable-next-line no-var
  var __sigintRegistered: boolean | undefined;
}

if (!globalThis.__sigintRegistered) {
  globalThis.__sigintRegistered = true;
  process.on("SIGINT", () => {
    console.log("\n[hooks] SIGINT received – flushing DB…");
    getDB().flush();
    console.log("[hooks] DB flushed, exiting.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    console.log("\n[hooks] SIGTERM received \u2013 flushing DB\u2026");
    getDB().flush();
    console.log("[hooks] DB flushed, exiting.");
    process.exit(0);
  });
}

// Ensure server.json exists at startup
config.ensureServerJson();

// ─── Redirect Guard ───────────────────────────────────────────────────────────

/** Paths that bypass the collection-ready check */
function isWhitelisted(pathname: string): boolean {
  return (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/api/maintenance/setup") ||
    // Static assets served by Vite / adapter-node: don't need DB
    pathname.startsWith("/_app/") ||
    pathname.startsWith("/favicon")
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (isWhitelisted(pathname)) {
    return resolve(event);
  }

  // DB 記憶體優先；只有尚未載入 (通常代表首次載入) 時才讀 server.json (避免每次請求都做 I/O)
  const jsonDB = getDB();
  const root = jsonDB.getCurrentRoot() ?? config.getCollectionRoot();

  if (!root) {
    throw redirect(303, "/settings?alert=default");
  }

  if (!config.isCollectionValid(root)) {
    throw redirect(303, "/settings?alert=error");
  }

  if (!jsonDB.isLoaded() || jsonDB.getCurrentRoot() !== root) {
    jsonDB.loadCollection(root);
  }

  return resolve(event);
};
