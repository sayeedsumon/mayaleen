-- Website photo library (Settings › Photos). Idempotent.
CREATE TABLE IF NOT EXISTS "SitePhoto" (
    "id" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT 'GALLERY',
    "alt" TEXT NOT NULL DEFAULT '',
    "focus" TEXT NOT NULL DEFAULT 'center',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SitePhoto_place_sort_idx" ON "SitePhoto"("place", "sort");
