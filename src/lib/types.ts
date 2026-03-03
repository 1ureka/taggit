// ─── Image Record ─────────────────────────────────────────────────────────────

export interface ImageRecord {
  ext: string; // '.png', '.jpg', etc.
  originalName: string; // original filename
  tags: string[]; // tag list
  rating: number; // 0-5
  committedAt: number; // Unix ms
  updatedAt: number; // Unix ms (conflict detection)
  fileSize: number; // bytes
  width: number; // px, 0 = unknown
  height: number; // px, 0 = unknown
}

export interface TrashedImageRecord extends ImageRecord {
  trashedAt: number; // Unix ms
}

export interface ImageWithId extends ImageRecord {
  id: string;
}

export interface TrashedImageWithId extends TrashedImageRecord {
  id: string;
}

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

export interface DBData {
  version: number;
  images: Record<string, ImageRecord>;
  trashedImages: Record<string, TrashedImageRecord>;
}

// ─── Query ───────────────────────────────────────────────────────────────────

export interface ListOptions {
  tags?: string[];
  rating?: number;
  ratingOp?: "gte" | "lte" | "eq";
  sort?: "committedAt" | "rating" | "originalName";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ListResult {
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
