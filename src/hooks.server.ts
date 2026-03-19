import { requireDatabase } from "$lib/server/db-instance.js";

// Graceful Shutdown
//
// Flush the in-memory DB to disk when the process receives SIGINT (Ctrl-C).
// Only register once (HMR-safe via a globalThis flag).

declare global {
  var __sigintRegistered: boolean | undefined;
}

if (!globalThis.__sigintRegistered) {
  globalThis.__sigintRegistered = true;
  process.on("SIGINT", () => {
    console.log("\n[hooks] SIGINT received – flushing DB…");
    requireDatabase({ allowUnload: true }).db.flush();
    console.log("[hooks] DB flushed, exiting.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    console.log("\n[hooks] SIGTERM received – flushing DB…");
    requireDatabase({ allowUnload: true }).db.flush();
    console.log("[hooks] DB flushed, exiting.");
    process.exit(0);
  });
}
