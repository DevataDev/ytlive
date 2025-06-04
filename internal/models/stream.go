package models

import (
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/gorm"
)

type Stream struct {
	ID               string  `gorm:"primaryKey"`
	Name             string  `gorm:"not null;default:'Live Stream'" json:"name"`
	Description      *string `gorm:"type:text;default:null" json:"description,omitempty"`
	Status           string  `gorm:"not null"`     // "live", "scheduled", "stopped"
	FfmpegPID        *int    `gorm:"default:null"` // Optional, for managing ffmpeg process
	ScheduledAt      *time.Time
	ScheduledStartAt *time.Time `gorm:"column:scheduled_start_at;default:null" json:"ScheduledStartAt"`
	ScheduledEndAt   *time.Time `gorm:"column:scheduled_end_at;default:null" json:"ScheduledEndAt"`
	StartedAt        *time.Time
	StoppedAt        *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
	DeletedAt        gorm.DeletedAt `gorm:"index"`
	RTMPUrl          string         `gorm:"column:rtmp_url;default:'rtmp://a.rtmp.youtube.com/live2/'" json:"RTMPUrl"`
	LoopVideo        bool           `gorm:"column:loop_video;default:true" json:"LoopVideo"`
	StreamKey        string         `gorm:"column:stream_key" json:"StreamKey"`
	MaxBitrate       *int           `gorm:"column:max_bitrate" json:"MaxBitrate,omitempty"`
	LoopCount        *int           `gorm:"column:loop_count;default:-1" json:"LoopCount,omitempty"`
	UserID           string         `gorm:"not null;index" json:"UserId"`
	ChannelID        *string        `gorm:"default:null" json:"ChannelId,omitempty"`

	// Ganti relationship lama dengan many-to-many
	// MediaFiles       []MediaFile    `gorm:"foreignKey:StreamID;constraint:OnDelete:CASCADE;" json:"media_files,omitempty"`
	// MediaFiles []MediaFile `gorm:"many2many:stream_media_files;foreignKey:ID;joinForeignKey:StreamID;References:ID;joinReferences:MediaFileID" json:"media_files,omitempty"`
	// In Stream model:
	StreamMediaFiles []StreamMediaFile `gorm:"foreignKey:StreamID" json:"stream_media_files,omitempty"`
}

// MigrateStreams handles database migrations for the Stream model
func MigrateStreams(db *gorm.DB) error {
	// First, check the database dialect
	var isSQLite bool
	dbDialect := db.Dialector.Name()
	log.Println("Database dialect:", dbDialect)
	switch dbDialect {
	case "sqlite":
		isSQLite = true
	case "sqlite3":
		isSQLite = true
	}

	// For SQLite, we need to use a different approach
	if isSQLite {
		log.Println("Detected SQLite database, checking table schema...")

		// Check if the table exists at all
		var tableExists bool
		err := db.Raw("SELECT 1 FROM sqlite_master WHERE type='table' AND name='streams'").Scan(&tableExists).Error
		if err != nil || !tableExists {
			// Table doesn't exist, just create it with AutoMigrate
			log.Println("Streams table doesn't exist, creating with AutoMigrate...")
			return db.AutoMigrate(&Stream{})
		}

		// Check if the name column exists and is NOT NULL
		var tableInfo []struct {
			SQL string `gorm:"column:sql"`
		}

		// Query the SQL used to create the table
		err = db.Raw("SELECT sql FROM sqlite_master WHERE type='table' AND name='streams'").Scan(&tableInfo).Error
		if err != nil {
			log.Printf("Warning: Failed to get table info: %v. Attempting migration anyway...", err)
			return migrateSQLiteStreams(db)
		}

		log.Printf("Table info: %+v", tableInfo)
		log.Printf("Table info length: %d", len(tableInfo))
		if len(tableInfo) > 0 && tableInfo[0].SQL != "" {
			log.Printf("Table creation SQL: %s", tableInfo[0].SQL)
		}

		// If we can't determine the schema, be safe and attempt the migration
		if len(tableInfo) == 0 || tableInfo[0].SQL == "" {
			log.Println("Warning: Could not determine table schema. Attempting migration...")
			return migrateSQLiteStreams(db)
		}

		// Check if name column has NOT NULL constraint
		sqlUpper := strings.ToUpper(tableInfo[0].SQL)
		hasNotNull := strings.Contains(sqlUpper, "NAME TEXT NOT NULL") ||
			strings.Contains(sqlUpper, "NAME VARCHAR NOT NULL") ||
			strings.Contains(sqlUpper, "NAME TEXT DEFAULT")

		if hasNotNull {
			// SQLite doesn't support ALTER COLUMN, so we need to recreate the table
			log.Println("Detected NOT NULL constraint on name column. Migrating SQLite streams table...")
			return migrateSQLiteStreams(db)
		} else {
			log.Println("No NOT NULL constraint detected on name column. Using standard migration.")
			// drop file_name column and ignore error
			err = db.Exec(`ALTER TABLE streams DROP COLUMN file_name`).Error
			if err != nil {
				log.Printf("Warning: Failed to drop file_name column: %v", err)
			}
		}
	} else {
		// For other databases (MySQL, PostgreSQL, etc.)
		// First handle the name column NOT NULL constraint if needed
		var nameCount int64
		db.Raw(`
			SELECT COUNT(*)
			FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME = 'streams'
			AND COLUMN_NAME = 'name'
			AND IS_NULLABLE = 'NO'`).Scan(&nameCount)

		if nameCount > 0 {
			// First, add a temporary column
			err := db.Exec(`ALTER TABLE streams ADD COLUMN temp_name TEXT`).Error
			if err != nil {
				return fmt.Errorf("failed to add temp_name column: %v", err)
			}

			// Copy data to temporary column
			err = db.Exec(`UPDATE streams SET temp_name = name`).Error
			if err != nil {
				return fmt.Errorf("failed to copy data to temp_name: %v", err)
			}

			// Drop the old NOT NULL column
			err = db.Exec(`ALTER TABLE streams DROP COLUMN name`).Error
			if err != nil {
				return fmt.Errorf("failed to drop name column: %v", err)
			}

			// Rename temp column to name
			err = db.Exec(`ALTER TABLE streams CHANGE COLUMN temp_name name TEXT`).Error
			if err != nil {
				return fmt.Errorf("failed to rename temp_name to name: %v", err)
			}
		}

		// Check if file_name column exists and drop it if it does
		var fileCount int64
		err := db.Raw(`
			SELECT COUNT(*)
			FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME = 'streams'
			AND COLUMN_NAME = 'file_name'`).Scan(&fileCount).Error

		if err != nil {
			log.Printf("Warning: Failed to check for file_name column: %v", err)
		} else if fileCount > 0 {
			log.Println("Dropping old file_name column from MySQL/PostgreSQL...")
			err = db.Exec(`ALTER TABLE streams DROP COLUMN file_name`).Error
			if err != nil {
				return fmt.Errorf("failed to drop file_name column: %v", err)
			}
			log.Println("Successfully dropped file_name column from MySQL/PostgreSQL")
		}
	}

	// Now run the auto-migration for any other changes
	return db.AutoMigrate(&Stream{})
}

// migrateSQLiteStreams handles the migration for SQLite which has limited ALTER TABLE support
func migrateSQLiteStreams(db *gorm.DB) error {
	// Begin a transaction
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	log.Println("Starting migration of SQLite streams table...")

	// First, check if the file_name column exists and drop it if it does
	var count int64
	err := tx.Raw(`
		SELECT COUNT(*) FROM pragma_table_info('streams') 
		WHERE name = 'file_name'
	`).Scan(&count).Error
	if err != nil {
		log.Printf("Warning: Failed to check for file_name column: %v", err)
		// Continue with migration even if we can't check
	}

	if count > 0 {
		log.Println("Dropping old file_name column...")
		err = tx.Exec(`
			CREATE TABLE streams_new (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				status TEXT NOT NULL,
				ffmpeg_pid INTEGER,
				scheduled_at DATETIME,
				scheduled_start_at DATETIME,
				scheduled_end_at DATETIME,
				started_at DATETIME,
				stopped_at DATETIME,
				created_at DATETIME,
				updated_at DATETIME,
				deleted_at DATETIME,
				rtmp_url TEXT DEFAULT 'rtmp://a.rtmp.youtube.com/live2/',
				loop_video BOOLEAN DEFAULT 1,
				stream_key TEXT,
				max_bitrate INTEGER,
				loop_count INTEGER DEFAULT -1,
				user_id TEXT NOT NULL,
				channel_id TEXT
			);

			INSERT INTO streams_new (
				id, name, description, status, ffmpeg_pid, scheduled_at, scheduled_start_at,
				scheduled_end_at, started_at, stopped_at, created_at, updated_at,
				deleted_at, rtmp_url, loop_video, stream_key, max_bitrate,
				loop_count, user_id, channel_id
			) SELECT 
				id, name, '', status, ffmpeg_pid, scheduled_at, scheduled_start_at,
				scheduled_end_at, started_at, stopped_at, created_at, updated_at,
				deleted_at, rtmp_url, loop_video, stream_key, max_bitrate,
				loop_count, user_id, channel_id
			FROM streams;

			DROP TABLE streams;
			ALTER TABLE streams_new RENAME TO streams;
		`).Error

		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to drop file_name column: %v", err)
		}

		log.Println("Successfully dropped file_name column")
		return tx.Commit().Error
	}

	log.Println("No file_name column found, proceeding with standard migration")

	// 1. Create a new table with the desired schema
	err = tx.Exec(`CREATE TABLE IF NOT EXISTS streams_new (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		status TEXT NOT NULL,
		ffmpeg_pid INTEGER,
		scheduled_at DATETIME,
		scheduled_start_at DATETIME,
		scheduled_end_at DATETIME,
		started_at DATETIME,
		stopped_at DATETIME,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME,
		rtmp_url TEXT DEFAULT 'rtmp://a.rtmp.youtube.com/live2/',
		loop_video BOOLEAN DEFAULT 1,
		stream_key TEXT,
		max_bitrate INTEGER,
		loop_count INTEGER DEFAULT -1,
		user_id TEXT NOT NULL,
		channel_id TEXT
	)`).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create new streams table: %v", err)
	}

	log.Println("Created new streams table successfully.")

	// 2. Copy data from old table to new table
	err = tx.Exec(`
		INSERT INTO streams_new (
			id, name, description, status, ffmpeg_pid, scheduled_at, scheduled_start_at,
			scheduled_end_at, started_at, stopped_at, created_at, updated_at,
			deleted_at, rtmp_url, loop_video, stream_key, max_bitrate,
			loop_count, user_id, channel_id
		) SELECT 
			id, 
			COALESCE(name, 'Untitled Stream'),
			'',
			COALESCE(status, 'stopped'), 
			ffmpeg_pid, scheduled_at, scheduled_start_at,
			scheduled_end_at, started_at, stopped_at, created_at, updated_at,
			deleted_at, COALESCE(rtmp_url, 'rtmp://a.rtmp.youtube.com/live2/'), 
			COALESCE(loop_video, 1), stream_key, max_bitrate,
			COALESCE(loop_count, -1), user_id, channel_id
		FROM streams
	`).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to copy data to new table: %v", err)
	}

	log.Println("Copied data to new streams table successfully.")

	// 3. Drop old table
	err = tx.Exec(`DROP TABLE streams`).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to drop old streams table: %v", err)
	}

	// 4. Rename new table
	err = tx.Exec(`ALTER TABLE streams_new RENAME TO streams`).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to rename new streams table: %v", err)
	}

	log.Println("Renamed new streams table successfully.")

	// 5. Recreate indexes
	err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_streams_deleted_at ON streams(deleted_at)`).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create deleted_at index: %v", err)
	}

	err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id)`).Error
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create user_id index: %v", err)
	}

	log.Println("Migrated SQLite streams table successfully.")

	// Commit the transaction
	return tx.Commit().Error
}
