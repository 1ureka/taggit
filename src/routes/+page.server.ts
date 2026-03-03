import type { PageServerLoad } from "./$types.js";
import { getStats } from "$lib/server/db.js";

export const load: PageServerLoad = () => {
  // Phase 1: just return stats for smoke-test
  // Phase 3.1 will add navigation cards and richer UI
  return { stats: getStats() };
};
