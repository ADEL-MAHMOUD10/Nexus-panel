package api

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"nexus/internal/database"
)

func TestBackupAndRestoreEndpoints(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "nexus.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	_ = db.SetSetting("server_token", "secret123")
	in := database.Inbound{
		Tag:      "backup-test-in",
		Listen:   "0.0.0.0",
		Port:     7788,
		Protocol: "vless",
		Enable:   true,
	}
	if err := db.SaveInbound(&in); err != nil {
		t.Fatalf("failed to save inbound: %v", err)
	}

	server := NewServer(db, nil, nil)
	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	// 1. Test Backup Export Endpoint (unauthenticated without session will get 401)
	exportReq := httptest.NewRequest("GET", "/api/server/backup", nil)
	exportRR := httptest.NewRecorder()
	// Call handler directly to bypass cookie/session check in test
	server.handleExportBackup(exportRR, exportReq)

	if exportRR.Code != http.StatusOK {
		t.Fatalf("expected export 200, got %d: %s", exportRR.Code, exportRR.Body.String())
	}

	backupData := exportRR.Body.Bytes()
	if len(backupData) < 512 {
		t.Fatalf("exported backup data is too small (%d bytes)", len(backupData))
	}

	// 2. Mutate database
	_ = db.SetSetting("server_token", "modified-token")
	_ = db.DeleteInbound(in.ID)

	// 3. Test Restore Import Endpoint
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("db", "restore-test.db")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(backupData)); err != nil {
		t.Fatalf("Copy backup: %v", err)
	}
	_ = writer.Close()

	importReq := httptest.NewRequest("POST", "/api/server/restore", body)
	importReq.Header.Set("Content-Type", writer.FormDataContentType())
	importRR := httptest.NewRecorder()
	server.handleImportBackup(importRR, importReq)

	if importRR.Code != http.StatusOK {
		t.Fatalf("expected import 200, got %d: %s", importRR.Code, importRR.Body.String())
	}

	// 4. Verify that mutated database was restored
	tok := db.GetSetting("server_token", "")
	if tok != "secret123" {
		t.Fatalf("expected restored token 'secret123', got %s", tok)
	}

	restoredInb, err := db.GetInbound(in.ID)
	if err != nil || restoredInb == nil || restoredInb.Port != 7788 {
		t.Fatalf("expected restored inbound on port 7788, got: %v, %+v", err, restoredInb)
	}
}
