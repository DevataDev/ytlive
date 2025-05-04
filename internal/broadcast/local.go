package broadcast

import "sync"

type EventType string

const (
	RefreshStream EventType = "refresh_stream"
	StopStream    EventType = "stop_stream"
	RefreshMirror EventType = "refresh_mirror"
	StartMirror   EventType = "start_mirror"
	StartStream   EventType = "start_stream"
	AddToMirror   EventType = "add_to_mirror"
)

type Event struct {
	Type EventType
	Data interface{}
}

type LocalBroadcast struct {
	mu     sync.RWMutex
	events map[string][]func(e Event)
}

func NewLocalBroadcast() *LocalBroadcast {
	return &LocalBroadcast{
		events: make(map[string][]func(e Event)),
	}
}

func (b *LocalBroadcast) AddListener(id string, eventType EventType, listener func(e Event)) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events[string(eventType)] = append(b.events[string(eventType)], listener)
}

func (b *LocalBroadcast) RemoveListener(id string, eventType EventType, listener func(e Event)) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i, l := range b.events[string(eventType)] {
		if &l == &listener {
			b.events[string(eventType)] = append(b.events[string(eventType)][:i], b.events[string(eventType)][i+1:]...)
			break
		}
	}
}

func (b *LocalBroadcast) Broadcast(eventType EventType, data interface{}) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, listener := range b.events[string(eventType)] {
		listener(Event{Type: eventType, Data: data})
	}
}

var Bus = NewLocalBroadcast()
