-- Migration untuk membuat tabel junction stream_media_files
CREATE TABLE IF NOT EXISTS stream_media_files (
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
    
    -- Unique constraint untuk mencegah duplikasi
    UNIQUE(stream_id, media_file_id)
);

-- Index untuk performa
CREATE INDEX idx_stream_media_files_stream_id ON stream_media_files(stream_id);
CREATE INDEX idx_stream_media_files_media_file_id ON stream_media_files(media_file_id);
CREATE INDEX idx_stream_media_files_deleted_at ON stream_media_files(deleted_at);

-- Hapus kolom stream_id dari tabel media_files (jika ada)
-- ALTER TABLE media_files DROP COLUMN stream_id;