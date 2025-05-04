package cache

import (
	"errors"
	"sync"
	"time"
)

type InMemoryCache struct {
	cache map[string]CacheItem
	mu    sync.Mutex
}

type CacheItem struct {
	Value interface{}
	TTL   time.Time
}

func NewInMemoryCache() *InMemoryCache {
	return &InMemoryCache{
		cache: make(map[string]CacheItem),
	}
}

func (c *InMemoryCache) Set(key string, value interface{}, ttl time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = CacheItem{
		Value: value,
		TTL:   ttl,
	}
}

func (c *InMemoryCache) Get(key string) (interface{}, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.cache[key]
	if !ok {
		return nil, errors.New("key not found")
	}
	if time.Now().After(item.TTL) {
		delete(c.cache, key)
		return nil, errors.New("key expired")
	}
	return item.Value, nil
}

func (c *InMemoryCache) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.cache[key]
	return ok
}

func (c *InMemoryCache) GetTTL(key string) (time.Time, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.cache[key]
	if !ok {
		return time.Time{}, errors.New("key not found")
	}
	return item.TTL, nil
}

func (c *InMemoryCache) GetRemainingTTL(key string) (time.Duration, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.cache[key]
	if !ok {
		return 0, errors.New("key not found")
	}
	return time.Until(item.TTL), nil
}

func (c *InMemoryCache) GetExpiredKeys() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	var expiredKeys []string
	for key, item := range c.cache {
		if time.Now().After(item.TTL) {
			expiredKeys = append(expiredKeys, key)
		}
	}
	return expiredKeys
}

func (c *InMemoryCache) DeleteExpiredKeys() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key, item := range c.cache {
		if time.Now().After(item.TTL) {
			delete(c.cache, key)
		}
	}
}

func (c *InMemoryCache) GetAll() map[string]interface{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	all := make(map[string]interface{}, len(c.cache))
	for key, item := range c.cache {
		all[key] = item.Value
	}
	return all
}

func (c *InMemoryCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, key)
}

func (c *InMemoryCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]CacheItem)
}

func (c *InMemoryCache) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = nil
}

func (c *InMemoryCache) Size() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.cache)
}

func (c *InMemoryCache) IsEmpty() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.cache) == 0
}

func (c *InMemoryCache) IsClosed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cache == nil
}

func (c *InMemoryCache) Stats() map[string]interface{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	return map[string]interface{}{
		"size": c.Size(),
	}
}
