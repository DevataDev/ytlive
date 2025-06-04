-- 1. Disable foreign key checks
PRAGMA foreign_keys=off;

-- 2. Create new table with primary key
CREATE TABLE stream_media_files_new (
    id VARCHAR(26) PRIMARY KEY,
    stream_id VARCHAR(26) NOT NULL,
    media_file_id VARCHAR(26) NOT NULL,
    "order" INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE CASCADE,
    FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE CASCADE,
    UNIQUE(stream_id, media_file_id)
);

-- 3. Copy data from old table (if it exists and has data)
-- INSERT INTO stream_media_files_new (stream_id, media_file_id, "order", is_primary, created_at, updated_at, deleted_at)
-- SELECT stream_id, media_file_id, "order", is_primary, created_at, updated_at, deleted_at FROM stream_media_files;

-- 4. Drop old table
DROP TABLE IF EXISTS stream_media_files;

-- 5. Rename new table
ALTER TABLE stream_media_files_new RENAME TO stream_media_files;

-- 6. Recreate indexes
CREATE INDEX idx_stream_media_files_stream_id ON stream_media_files(stream_id);
CREATE INDEX idx_stream_media_files_media_file_id ON stream_media_files(media_file_id);
CREATE INDEX idx_stream_media_files_deleted_at ON stream_media_files(deleted_at);

-- 7. Re-enable foreign key checks
PRAGMA foreign_keys=on;