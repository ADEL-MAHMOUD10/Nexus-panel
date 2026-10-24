package api

import (
	"net"
	"os"
	"strconv"
	"testing"

	"nexus/internal/database"
)

func TestPortAvailabilityDetection(t *testing.T) {
	tmpDB := "test_port_guard.db"
	_ = os.Remove(tmpDB)
	defer os.Remove(tmpDB)

	db, err := database.Open(tmpDB)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	srv := &Server{db: db}

	// 1. Pick a temporary listener on an ephemeral port to simulate an active OS process
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to create dummy listener: %v", err)
	}
	defer ln.Close()

	_, portStr, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatalf("failed to split host port: %v", err)
	}
	occupiedPort, _ := strconv.Atoi(portStr)

	// 2. Test checking availability for this port
	res := srv.checkPortAvailability("127.0.0.1", occupiedPort, "vless", `{"network":"tcp"}`, 0, "")
	if res.Available {
		t.Errorf("expected port %d to be unavailable, but got available=true", occupiedPort)
	}
	if !res.TCPInUse {
		t.Errorf("expected TCPInUse=true for port %d", occupiedPort)
	}

	// 3. Test WireGuard (UDP) checking the same port - now that both TCP and UDP are guarded, it MUST report conflict!
	wgRes := srv.checkPortAvailability("127.0.0.1", occupiedPort, "wireguard", "", 0, "")
	if wgRes.Available {
		t.Errorf("expected WireGuard on port %d to report collision because TCP is occupied, got available=true", occupiedPort)
	}

	// 4. Test database conflict across different protocols
	inbound1 := database.Inbound{
		Port:     15432,
		Protocol: "vless",
		Tag:      "vless-in",
		Enable:   true,
	}
	if err := db.SaveInbound(&inbound1); err != nil {
		t.Fatalf("failed to save inbound1: %v", err)
	}

	// Another inbound with WireGuard (UDP) on the same port must conflict!
	dbRes := srv.checkPortAvailability("0.0.0.0", 15432, "wireguard", "", 0, "")
	if dbRes.Available {
		t.Errorf("expected database conflict between VLESS and WireGuard on port 15432, got available=true")
	}

	// 5. Test Firewall Info evaluation
	fw := checkPortFirewall(15432)
	if fw.Engine == "" || fw.Status == "" {
		t.Errorf("expected valid firewall engine and status, got: %+v", fw)
	}

	t.Logf("Port Guard Test Passed! Occupied Port Check: %+v, Firewall Info: %+v", res, fw)
}
