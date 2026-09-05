package proxy

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"apanel/internal/db"
	"apanel/internal/dependency"
	"apanel/internal/settings"
)

func TestTestDelaysEmitsInCompletionOrder(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("url") != testURL || r.URL.Query().Get("timeout") != testTimeout {
			t.Errorf("unexpected delay query: %s", r.URL.RawQuery)
		}
		switch r.URL.Path {
		case "/proxies/slow/delay":
			time.Sleep(100 * time.Millisecond)
			_ = json.NewEncoder(w).Encode(map[string]int{"delay": 200})
		case "/proxies/fast/delay":
			_ = json.NewEncoder(w).Encode(map[string]int{"delay": 20})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	t.Setenv("APANEL_DB_PATH", filepath.Join(t.TempDir(), "apanel.db"))
	database, err := db.Open()
	if err != nil {
		t.Fatal(err)
	}
	settingsManager := settings.New(database)
	connection, _ := json.Marshal(map[string]string{"url": server.URL})
	if err := settingsManager.Set(dependency.ConnectionSettingsKey("proxy"), string(connection)); err != nil {
		t.Fatal(err)
	}

	manager := New(settingsManager)
	manager.client = server.Client()
	var results []DelayResult
	err = manager.TestDelays(context.Background(), []ProxyOption{{Name: "slow"}, {Name: "fast"}}, func(result DelayResult) {
		results = append(results, result)
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 {
		t.Fatalf("got %d results, want 2", len(results))
	}
	if results[0] != (DelayResult{Name: "fast", Delay: 20}) {
		t.Fatalf("first result = %#v, want fast proxy", results[0])
	}
	if results[1] != (DelayResult{Name: "slow", Delay: 200}) {
		t.Fatalf("second result = %#v, want slow proxy", results[1])
	}
}
