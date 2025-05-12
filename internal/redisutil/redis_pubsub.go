package redisutil

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"
	"windsorf-youtube-live/internal/configuration"

	"github.com/redis/go-redis/v9"
)

type RedisPubSub struct {
	RedisClient *redis.Client
	Config      *configuration.Config
}

func (r *RedisPubSub) InitRedis() error {
	if r.Config.Redis.Host == "" {
		return errors.New("redis host is empty")
	}
	if r.Config.Redis.Port == 0 {
		return errors.New("redis port is empty")
	}
	redisAddr := r.Config.Redis.Host + ":" + strconv.Itoa(r.Config.Redis.Port)
	r.RedisClient = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: r.Config.Redis.Password,
		DB:       r.Config.Redis.DB,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return r.RedisClient.Ping(ctx).Err()
}

func (r *RedisPubSub) PublishFFmpegLog(ctx context.Context, channel, log string) error {
	return r.RedisClient.Publish(ctx, channel, log).Err()
}

func (r *RedisPubSub) SubscribeFFmpegLog(ctx context.Context, channel string) *redis.PubSub {
	return r.RedisClient.Subscribe(ctx, channel)
}

func (r *RedisPubSub) GetFFmpegLogChannel(streamKey string) string {
	return "ffmpeg-logs:" + strings.ReplaceAll(streamKey, ":", "_")
}

// GetFFmpegLogs fetches the latest N logs from a Redis list for the given channel.
func (r *RedisPubSub) GetFFmpegLogs(ctx context.Context, channel string, count int64) ([]string, error) {
	// LRANGE channel -count -1 gets the last 'count' entries
	logs, err := r.RedisClient.LRange(ctx, channel, -count, -1).Result()
	if err != nil {
		return nil, err
	}
	return logs, nil
}
