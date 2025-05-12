package redisutil

import (
	"context"
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
	redisAddr := r.Config.Redis.Host + ":" + string(r.Config.Redis.Port)
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	r.RedisClient = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "", // set if needed
		DB:       0,  // use default DB
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
