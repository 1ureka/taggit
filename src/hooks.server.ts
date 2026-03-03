import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit";
import * as config from "$lib/server/config.js";
import * as db from "$lib/server/db.js";

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
    db.flush();
    console.log("[hooks] DB flushed, exiting.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    console.log("\n[hooks] SIGTERM received – flushing DB…");
    db.flush();
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
    pathname.startsWith("/setup") ||
    pathname.startsWith("/api/setup") ||
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

  const root = config.getCollectionRoot();

  if (!root) {
    throw redirect(303, "/setup?alert=default");
  }

  if (!config.isCollectionValid(root)) {
    throw redirect(303, "/setup?alert=error");
  }

  // Ensure DB is loaded (or reload if collection was switched)
  if (!db.isLoaded() || db.getCurrentRoot() !== root) {
    db.loadCollection(root);
  }

  return resolve(event);
};
