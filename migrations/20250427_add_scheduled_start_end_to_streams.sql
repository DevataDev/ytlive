-- Add scheduled_start_at and scheduled_end_at columns to streams table
ALTER TABLE streams
    ADD COLUMN scheduled_start_at DATETIME NULL DEFAULT NULL,
    ADD COLUMN scheduled_end_at DATETIME NULL DEFAULT NULL;
