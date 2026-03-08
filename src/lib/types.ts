// ─── Image ─────────────────────────────────────────────────────────────

export interface ImageRecord {
  ext: string; // '.png', '.jpg', etc.
  name: string; // user-editable image name
  tags: string[]; // tag list
  rating: number; // 0-5
  committedAt: number; // Unix ms
  updatedAt: number; // Unix ms (conflict detection)
  fileSize: number; // bytes
  width: number; // px, 0 = unknown
  height: number; // px, 0 = unknown
  blurhash: string; // BlurHash string, empty = unable to compute
}

export interface ImageWithId extends ImageRecord {
  id: string;
}

export type ImageArea = "committed" | "staged" | "trash";

export type ImageSize = "sm" | "md" | "xl";

// ─── Server Config ────────────────────────────────────────────────────────────

export interface ServerConfig {
  collectionRoot?: string; // abs path; undefined = not yet set
}

// ─── Collection Paths ─────────────────────────────────────────────────────────

export interface CollectionPaths {
  root: string;
  staged: string;
  committed: string;
  trash: string;
  db: string;
}

// ─── DB ──────────────────────────────────────────────────────────────────────

/**
 * db.json structure
 */
export interface DBData {
  version: number;
  images: Record<string, ImageRecord>;
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Unified query options for image listing.
 * - If `limit` is set (> 0), results are paginated.
 * - If `limit` is omitted or 0, ALL matching results are returned (no pagination).
 */
export interface QueryOptions {
  search?: string; // name substring search
  tags?: string[];
  rating?: number;
  ratingOp?: "gte" | "lte" | "eq";
  sort?: "committedAt" | "rating" | "name" | "random";
  order?: "asc" | "desc";
  page?: number;
  limit?: number; // 0 or undefined = return all
}

export interface QueryResult {
  items: ImageWithId[];
  total: number;
  page: number;
  pages: number;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export interface TagInfo {
  name: string;
  count: number;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface Stats {
  totalImages: number;
  totalTags: number;
  stagedCount: number;
  trashCount: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
