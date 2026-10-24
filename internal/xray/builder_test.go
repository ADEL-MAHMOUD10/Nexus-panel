package xray

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"testing"

	"nexus/internal/database"
)

func TestWireGuardConfigGenerationAndAutoHealing(t *testing.T) {
	tmpDB := "test_wg.db"
	_ = os.Remove(tmpDB)
	defer os.Remove(tmpDB)

	db, err := database.Open(tmpDB)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	// 1. Create an inbound with corrupt/invalid WireGuard secretKey (e.g. legacy short ID or hex string)
	corruptInbound := database.Inbound{
		Port:     51820,
		Protocol: "wireguard",
		Tag:      "wg-test",
		Enable:   true,
		Settings: `{"secretKey":"invalid-short-key","mtu":1420}`,
	}
	if err := db.SaveInbound(&corruptInbound); err != nil {
		t.Fatalf("failed to save inbound: %v", err)
	}

	// 2. Create a client with corrupt password/uuid (e.g. 16-character hex string)
	corruptClient := database.Client{
		InboundID: corruptInbound.ID,
		Email:     "corrupt_wg_peer",
		UUID:      "c74381ab-2a2b-426b-80df-39b039cb0117",
		Password:  "2a84210271ba37c6", // 16-hex characters that caused len(slice) != 32
		Enable:    true,
	}
	if err := db.SaveClient(&corruptClient); err != nil {
		t.Fatalf("failed to save client: %v", err)
	}

	// 3. Build inbound config - this MUST auto-heal without crashing
	inboundCfg, err := buildInboundConfig(db, &corruptInbound)
	if err != nil {
		t.Fatalf("buildInboundConfig failed: %v", err)
	}

	if inboundCfg.StreamSettings != nil {
		t.Errorf("wireguard streamSettings should be nil/omitted, got: %s", string(inboundCfg.StreamSettings))
	}

	var sett struct {
		SecretKey string `json:"secretKey"`
		MTU       int    `json:"mtu"`
		Peers     []struct {
			PublicKey  string   `json:"publicKey"`
			AllowedIPs []string `json:"allowedIPs"`
			Email      string   `json:"email"`
		} `json:"peers"`
	}
	if err := json.Unmarshal(inboundCfg.Settings, &sett); err != nil {
		t.Fatalf("failed to unmarshal settings: %v", err)
	}

	// Check Server SecretKey is valid 32-byte Base64
	skBytes, err := base64.StdEncoding.DecodeString(sett.SecretKey)
	if err != nil {
		t.Fatalf("healed secretKey is not valid base64: %v", err)
	}
	if len(skBytes) != 32 {
		t.Fatalf("healed secretKey len = %d != 32", len(skBytes))
	}

	// Check Peer PublicKey is valid 32-byte Base64
	if len(sett.Peers) != 1 {
		t.Fatalf("expected 1 peer, got %d", len(sett.Peers))
	}
	pkBytes, err := base64.StdEncoding.DecodeString(sett.Peers[0].PublicKey)
	if err != nil {
		t.Fatalf("healed peer publicKey is not valid base64: %v", err)
	}
	if len(pkBytes) != 32 {
		t.Fatalf("healed peer publicKey len = %d != 32", len(pkBytes))
	}

	t.Logf("WireGuard auto-healed successfully! Server Key: %s, Peer Key: %s, AllowedIPs: %v",
		sett.SecretKey, sett.Peers[0].PublicKey, sett.Peers[0].AllowedIPs)
}
