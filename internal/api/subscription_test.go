package api

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"nexus/internal/database"
)

func TestSubscriptionHeaders(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "sub_test.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	// Seed inbound
	in := database.Inbound{
		Tag:            "vless-sub",
		Listen:         "0.0.0.0",
		Port:           2053,
		Protocol:       "vless",
		Enable:         true,
		StreamSettings: `{"network":"tcp","security":"none"}`,
	}
	if err := db.SaveInbound(&in); err != nil {
		t.Fatalf("failed to save inbound: %v", err)
	}

	expiry := time.Now().Add(30 * 24 * time.Hour).Unix()
	client := database.Client{
		InboundID:  in.ID,
		Email:      "subuser@test.com",
		UUID:       "11111111-2222-3333-4444-555555555555",
		SubID:      "testsub123",
		Enable:     true,
		Up:         1024 * 1024 * 50,  // 50MB
		Down:       1024 * 1024 * 150, // 150MB
		Total:      1024 * 1024 * 1024 * 10, // 10GB
		ExpiryTime: expiry,
	}
	if err := db.SaveClient(&client); err != nil {
		t.Fatalf("failed to save client: %v", err)
	}

	server := NewServer(db, nil, nil)
	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/sub/testsub123", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	userinfo := rr.Header().Get("Subscription-Userinfo")
	if userinfo == "" {
		t.Fatalf("missing Subscription-Userinfo header in response")
	}

	if updateInterval := rr.Header().Get("Profile-Update-Interval"); updateInterval != "24" {
		t.Errorf("expected Profile-Update-Interval: 24, got %q", updateInterval)
	}

	t.Logf("Subscription Userinfo Header Verified: %s", userinfo)
}
