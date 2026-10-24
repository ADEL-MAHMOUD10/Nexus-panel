package database

import (
	"path/filepath"
	"testing"
	"time"
)

func TestDatabaseIndexesAndOnlineClients(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	// Seed inbound
	in := Inbound{
		Tag:      "test-inbound",
		Listen:   "0.0.0.0",
		Port:     12345,
		Protocol: "vless",
		Enable:   true,
	}
	if err := db.SaveInbound(&in); err != nil {
		t.Fatalf("failed to save inbound: %v", err)
	}

	now := time.Now().Unix()

	// Seed active and inactive clients
	client1 := Client{
		InboundID:  in.ID,
		Email:      "active_user@example.com",
		UUID:       "00000000-0000-0000-0000-000000000001",
		Enable:     true,
		LastOnline: now - 30, // 30s ago -> active
	}
	client2 := Client{
		InboundID:  in.ID,
		Email:      "idle_user@example.com",
		UUID:       "00000000-0000-0000-0000-000000000002",
		Enable:     true,
		LastOnline: now - 300, // 300s ago -> inactive
	}

	if err := db.SaveClient(&client1); err != nil {
		t.Fatalf("failed to save client1: %v", err)
	}
	if err := db.SaveClient(&client2); err != nil {
		t.Fatalf("failed to save client2: %v", err)
	}

	// Test GetOnlineClientsFromDB with 90s grace period
	onlines, err := db.GetOnlineClientsFromDB(90)
	if err != nil {
		t.Fatalf("GetOnlineClientsFromDB failed: %v", err)
	}

	if len(onlines) != 1 || onlines[0] != "active_user@example.com" {
		t.Fatalf("expected 1 active user 'active_user@example.com', got %+v", onlines)
	}

	// Test UpdateClientsLastOnline batch update
	if err := db.UpdateClientsLastOnline([]string{"idle_user@example.com"}, now); err != nil {
		t.Fatalf("UpdateClientsLastOnline failed: %v", err)
	}

	onlinesAfterUpdate, err := db.GetOnlineClientsFromDB(90)
	if err != nil {
		t.Fatalf("GetOnlineClientsFromDB after update failed: %v", err)
	}
	if len(onlinesAfterUpdate) != 2 {
		t.Fatalf("expected 2 active users after update, got %+v", onlinesAfterUpdate)
	}
}

func TestDatabaseBackupAndRestore(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "original.db")
	backupPath := filepath.Join(tempDir, "snapshot.db")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	// Seed data
	_ = db.SetSetting("test_key", "original_value")
	in := Inbound{
		Tag:      "orig-tag",
		Listen:   "0.0.0.0",
		Port:     9999,
		Protocol: "trojan",
		Enable:   true,
	}
	if err := db.SaveInbound(&in); err != nil {
		t.Fatalf("failed to save inbound: %v", err)
	}

	// 1. Perform Backup
	if err := db.Backup(backupPath); err != nil {
		t.Fatalf("Backup failed: %v", err)
	}

	// 2. Validate Backup
	if err := ValidateSQLiteDB(backupPath); err != nil {
		t.Fatalf("ValidateSQLiteDB failed on backup: %v", err)
	}

	// 3. Mutate original DB
	_ = db.SetSetting("test_key", "mutated_value")
	_ = db.DeleteInbound(in.ID)

	valAfterMutate := db.GetSetting("test_key", "")
	if valAfterMutate != "mutated_value" {
		t.Fatalf("expected mutated_value, got %s", valAfterMutate)
	}

	// 4. Restore from Backup
	if err := db.Restore(backupPath); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}

	// 5. Verify restored state
	restoredVal := db.GetSetting("test_key", "")
	if restoredVal != "original_value" {
		t.Fatalf("expected restored 'original_value', got %s", restoredVal)
	}

	restoredInb, err := db.GetInbound(in.ID)
	if err != nil || restoredInb == nil || restoredInb.Port != 9999 {
		t.Fatalf("restored inbound check failed: err=%v, inb=%+v", err, restoredInb)
	}
}
