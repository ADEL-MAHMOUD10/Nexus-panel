package database

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// Inbound represents a listening proxy port in SQLite
type Inbound struct {
	ID             int    `json:"id"`
	Tag            string `json:"tag"`
	Listen         string `json:"listen"`
	Port           int    `json:"port"`
	Protocol       string `json:"protocol"` // "vless", "trojan"
	Enable         bool   `json:"enable"`
	Remark         string `json:"remark"`
	Settings       string `json:"settings"`       // JSON details
	StreamSettings string `json:"streamSettings"` // JSON transport details
	Sniffing       string `json:"sniffing"`       // JSON sniffing details
	Up             int64  `json:"up"`
	Down           int64  `json:"down"`
	Total          int64  `json:"total"`
	ExpiryTime     int64  `json:"expiryTime"`
}

// Client represents a proxy client attached to an inbound
type Client struct {
	ID         int    `json:"id"`
	InboundID  int    `json:"inboundId"`
	Email      string `json:"email"`
	UUID       string `json:"uuid,omitempty"`
	Password   string `json:"password,omitempty"`
	Flow       string `json:"flow,omitempty"`
	Enable     bool   `json:"enable"`
	Up         int64  `json:"up"`
	Down       int64  `json:"down"`
	Total      int64  `json:"total"`      // 0 means unlimited
	ExpiryTime int64  `json:"expiryTime"` // 0 means unlimited
	SubID      string `json:"subId"`
	LastOnline int64  `json:"lastOnline"`
}

// DB wraps SQLite operations for Nexus
type DB struct {
	conn *sql.DB
	path string
}

// Open initializes and migrates the SQLite database file
func Open(dbPath string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Single connection / busy timeout for reliable embedded SQLite
	conn.SetMaxOpenConns(1)

	// Enable WAL mode, Foreign Keys, and Busy Timeout for optimal SQLite performance
	_, _ = conn.Exec("PRAGMA journal_mode = WAL;")
	_, _ = conn.Exec("PRAGMA foreign_keys = ON;")
	_, _ = conn.Exec("PRAGMA busy_timeout = 5000;")
	_, _ = conn.Exec("PRAGMA synchronous = NORMAL;")

	db := &DB{conn: conn, path: dbPath}
	if err := db.migrate(); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// Path returns the SQLite database file path on disk
func (db *DB) Path() string {
	return db.path
}

// Backup creates a clean, consistent snapshot of the active SQLite database to destPath
func (db *DB) Backup(destPath string) error {
	_ = os.Remove(destPath)
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return err
	}

	escaped := strings.ReplaceAll(destPath, "'", "''")
	query := fmt.Sprintf("VACUUM INTO '%s'", escaped)
	_, err := db.conn.Exec(query)
	if err != nil {
		// Fallback: If VACUUM INTO fails, perform a safe file copy
		return db.safeFileCopy(destPath)
	}
	return nil
}

func (db *DB) safeFileCopy(destPath string) error {
	srcFile, err := os.Open(db.path)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	destFile, err := os.OpenFile(destPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, srcFile)
	return err
}

// ValidateSQLiteDB inspects an arbitrary database file and validates schema and integrity
func ValidateSQLiteDB(dbPath string) error {
	fileInfo, err := os.Stat(dbPath)
	if err != nil {
		return fmt.Errorf("backup file does not exist: %w", err)
	}
	if fileInfo.Size() < 512 {
		return errors.New("backup file is too small to be a valid SQLite database")
	}

	testConn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open uploaded database: %w", err)
	}
	defer testConn.Close()

	// Check SQLite integrity
	var integrity string
	if err := testConn.QueryRow("PRAGMA integrity_check;").Scan(&integrity); err != nil || integrity != "ok" {
		return fmt.Errorf("database integrity check failed: %s", integrity)
	}

	// Verify essential tables exist
	requiredTables := []string{"inbounds", "clients", "settings", "admins"}
	for _, tbl := range requiredTables {
		var count int
		err := testConn.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?", tbl).Scan(&count)
		if err != nil || count == 0 {
			return fmt.Errorf("backup database is missing required table: %s", tbl)
		}
	}

	return nil
}

// Restore validates the provided database file, creates a safety backup of the existing database,
// swaps in the new file, re-opens database connections, and re-runs schema migration.
func (db *DB) Restore(sourcePath string) error {
	if err := ValidateSQLiteDB(sourcePath); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// 1. Create a safety backup of current live DB
	backupPath := db.path + ".bak"
	_ = db.Backup(backupPath)

	// 2. Close current database connection
	if db.conn != nil {
		_ = db.conn.Close()
	}

	// 3. Remove WAL and SHM journal files
	_ = os.Remove(db.path + "-wal")
	_ = os.Remove(db.path + "-shm")

	// 4. Overwrite live DB with new database
	srcBytes, err := os.ReadFile(sourcePath)
	if err != nil {
		_ = db.reopen()
		return fmt.Errorf("failed to read source backup: %w", err)
	}

	if err := os.WriteFile(db.path, srcBytes, 0644); err != nil {
		_ = os.Rename(backupPath, db.path)
		_ = db.reopen()
		return fmt.Errorf("failed to write restored database: %w", err)
	}

	// 5. Re-open connection & re-apply pragmas and migrations
	if err := db.reopen(); err != nil {
		return fmt.Errorf("failed to re-open restored database: %w", err)
	}

	// 6. Run migrations to ensure any newly added columns/indexes exist
	_ = db.migrate()

	return nil
}

func (db *DB) reopen() error {
	conn, err := sql.Open("sqlite", db.path)
	if err != nil {
		return err
	}
	conn.SetMaxOpenConns(1)
	_, _ = conn.Exec("PRAGMA journal_mode = WAL;")
	_, _ = conn.Exec("PRAGMA foreign_keys = ON;")
	_, _ = conn.Exec("PRAGMA busy_timeout = 5000;")
	_, _ = conn.Exec("PRAGMA synchronous = NORMAL;")
	db.conn = conn
	return nil
}

func (db *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS admins (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS inbounds (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		tag TEXT UNIQUE NOT NULL,
		listen TEXT DEFAULT '0.0.0.0',
		port INTEGER NOT NULL,
		protocol TEXT NOT NULL,
		enable INTEGER DEFAULT 1,
		remark TEXT DEFAULT '',
		settings TEXT DEFAULT '{}',
		stream_settings TEXT DEFAULT '{}',
		sniffing TEXT DEFAULT '{}',
		up INTEGER DEFAULT 0,
		down INTEGER DEFAULT 0,
		total INTEGER DEFAULT 0,
		expiry_time INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS clients (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		inbound_id INTEGER NOT NULL,
		email TEXT NOT NULL,
		uuid TEXT DEFAULT '',
		password TEXT DEFAULT '',
		flow TEXT DEFAULT '',
		enable INTEGER DEFAULT 1,
		up INTEGER DEFAULT 0,
		down INTEGER DEFAULT 0,
		total INTEGER DEFAULT 0,
		expiry_time INTEGER DEFAULT 0,
		sub_id TEXT DEFAULT '',
		last_online INTEGER DEFAULT 0,
		FOREIGN KEY(inbound_id) REFERENCES inbounds(id) ON DELETE CASCADE,
		UNIQUE(inbound_id, email)
	);
	CREATE INDEX IF NOT EXISTS idx_client_sub_id ON clients(sub_id);
	CREATE INDEX IF NOT EXISTS idx_clients_inbound_id ON clients(inbound_id);
	CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
	CREATE INDEX IF NOT EXISTS idx_clients_last_online ON clients(last_online);
	CREATE INDEX IF NOT EXISTS idx_inbounds_port ON inbounds(port);
	`
	if _, err := db.conn.Exec(schema); err != nil {
		return err
	}
	// Best-effort column additions for existing databases
	_, _ = db.conn.Exec("ALTER TABLE inbounds ADD COLUMN listen TEXT DEFAULT '0.0.0.0'")
	_, _ = db.conn.Exec("ALTER TABLE inbounds ADD COLUMN sniffing TEXT DEFAULT '{}'")
	_, _ = db.conn.Exec("ALTER TABLE clients ADD COLUMN last_online INTEGER DEFAULT 0")
	return nil
}

// -----------------------------------------------------------------------------
// Settings Queries
// -----------------------------------------------------------------------------
func (db *DB) GetSetting(key, defaultVal string) string {
	var val string
	err := db.conn.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&val)
	if err != nil {
		return defaultVal
	}
	return val
}

func (db *DB) SetSetting(key, val string) error {
	_, err := db.conn.Exec(`
		INSERT INTO settings(key, value) VALUES(?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value
	`, key, val)
	return err
}

// -----------------------------------------------------------------------------
// Admin Queries
// -----------------------------------------------------------------------------
func (db *DB) SetAdmin(username, passwordHash string) error {
	_, err := db.conn.Exec(`
		INSERT INTO admins(id, username, password_hash) VALUES(1, ?, ?)
		ON CONFLICT(id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash
	`, username, passwordHash)
	return err
}

func (db *DB) GetAdmin() (username string, passwordHash string, err error) {
	err = db.conn.QueryRow("SELECT username, password_hash FROM admins WHERE id = 1").Scan(&username, &passwordHash)
	return
}

// -----------------------------------------------------------------------------
// Inbounds Queries
// -----------------------------------------------------------------------------
func (db *DB) GetAllInbounds() ([]Inbound, error) {
	rows, err := db.conn.Query("SELECT id, tag, listen, port, protocol, enable, remark, settings, stream_settings, sniffing, up, down, total, expiry_time FROM inbounds")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inbounds []Inbound
	for rows.Next() {
		var i Inbound
		var enableInt int
		if err := rows.Scan(&i.ID, &i.Tag, &i.Listen, &i.Port, &i.Protocol, &enableInt, &i.Remark, &i.Settings, &i.StreamSettings, &i.Sniffing, &i.Up, &i.Down, &i.Total, &i.ExpiryTime); err != nil {
			return nil, err
		}
		i.Enable = enableInt == 1
		inbounds = append(inbounds, i)
	}
	return inbounds, nil
}

func (db *DB) SaveInbound(i *Inbound) error {
	enableInt := 0
	if i.Enable {
		enableInt = 1
	}
	if i.Listen == "" {
		i.Listen = "0.0.0.0"
	}
	if i.Sniffing == "" {
		i.Sniffing = `{"enabled":true,"destOverride":["http","tls","quic","fakedns"]}`
	}

	if i.ID == 0 {
		res, err := db.conn.Exec(`
			INSERT INTO inbounds(tag, listen, port, protocol, enable, remark, settings, stream_settings, sniffing, up, down, total, expiry_time)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, i.Tag, i.Listen, i.Port, i.Protocol, enableInt, i.Remark, i.Settings, i.StreamSettings, i.Sniffing, i.Up, i.Down, i.Total, i.ExpiryTime)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		i.ID = int(id)
		return nil
	}

	_, err := db.conn.Exec(`
		UPDATE inbounds SET tag=?, listen=?, port=?, protocol=?, enable=?, remark=?, settings=?, stream_settings=?, sniffing=?, up=?, down=?, total=?, expiry_time=?
		WHERE id=?
	`, i.Tag, i.Listen, i.Port, i.Protocol, enableInt, i.Remark, i.Settings, i.StreamSettings, i.Sniffing, i.Up, i.Down, i.Total, i.ExpiryTime, i.ID)
	return err
}

func (db *DB) GetInbound(id int) (*Inbound, error) {
	row := db.conn.QueryRow("SELECT id, tag, listen, port, protocol, enable, remark, settings, stream_settings, sniffing, up, down, total, expiry_time FROM inbounds WHERE id = ?", id)
	var i Inbound
	var enableInt int
	if err := row.Scan(&i.ID, &i.Tag, &i.Listen, &i.Port, &i.Protocol, &enableInt, &i.Remark, &i.Settings, &i.StreamSettings, &i.Sniffing, &i.Up, &i.Down, &i.Total, &i.ExpiryTime); err != nil {
		return nil, err
	}
	i.Enable = enableInt == 1
	return &i, nil
}

func (db *DB) ResetInboundTraffic(id int) error {
	_, err := db.conn.Exec("UPDATE inbounds SET up = 0, down = 0 WHERE id = ?", id)
	return err
}

func (db *DB) DeleteInbound(id int) error {
	_, _ = db.conn.Exec("DELETE FROM clients WHERE inbound_id = ?", id)
	_, err := db.conn.Exec("DELETE FROM inbounds WHERE id = ?", id)
	return err
}


// CheckInboundPortConflict verifies whether a new/updated inbound collides on (IP, Port, Transport L4)
// with an existing inbound listener. Returns colliding Inbound if conflict exists, otherwise nil.
func (db *DB) CheckInboundPortConflict(target *Inbound, ignoreID int) (*Inbound, error) {
	inbounds, err := db.GetAllInbounds()
	if err != nil {
		return nil, err
	}

	targetListen := normalizeListen(target.Listen)

	for _, existing := range inbounds {
		if ignoreID > 0 && existing.ID == ignoreID {
			continue
		}
		if existing.Port != target.Port {
			continue
		}

		// Any two inbounds with the same port number on overlapping interfaces is a conflict
		existingListen := normalizeListen(existing.Listen)
		if listenOverlaps(targetListen, existingListen) {
			return &existing, nil
		}
	}

	return nil, nil
}

// TransportType represents L4 transport layer protocols (TCP and/or UDP)
type TransportType uint8

const (
	TransportTCP TransportType = 1 << 0
	TransportUDP TransportType = 1 << 1
)

// GetInboundTransport detects whether an inbound listens on TCP, UDP or both based on protocol and stream settings.
func GetInboundTransport(protocol, streamSettings string) TransportType {
	proto := strings.ToLower(strings.TrimSpace(protocol))
	switch proto {
	case "hysteria", "hysteria2", "tuic", "wireguard", "amneziawg":
		return TransportUDP
	case "shadowsocks", "dokodemo-door", "socks":
		// These protocols frequently bind both TCP and UDP
		return TransportTCP | TransportUDP
	}

	network := "tcp"
	if streamSettings != "" {
		var s map[string]any
		if json.Unmarshal([]byte(streamSettings), &s) == nil {
			if netStr, ok := s["network"].(string); ok && netStr != "" {
				network = strings.ToLower(netStr)
			}
		}
	}

	switch network {
	case "kcp", "mkcp", "quic":
		return TransportUDP
	default:
		return TransportTCP
	}
}

func normalizeListen(listen string) string {
	listen = strings.TrimSpace(listen)
	if listen == "" || listen == "0.0.0.0" || listen == "::" || listen == "::0" {
		return "0.0.0.0"
	}
	return listen
}

func listenOverlaps(a, b string) bool {
	if a == b {
		return true
	}
	if a == "0.0.0.0" || b == "0.0.0.0" {
		return true
	}
	ipA := net.ParseIP(a)
	ipB := net.ParseIP(b)
	if ipA != nil && ipB != nil && ipA.Equal(ipB) {
		return true
	}
	return false
}

// -----------------------------------------------------------------------------
// Clients Queries
// -----------------------------------------------------------------------------
func (db *DB) GetClientsByInbound(inboundID int) ([]Client, error) {
	rows, err := db.conn.Query("SELECT id, inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id, last_online FROM clients WHERE inbound_id = ?", inboundID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []Client
	for rows.Next() {
		var c Client
		var enableInt int
		if err := rows.Scan(&c.ID, &c.InboundID, &c.Email, &c.UUID, &c.Password, &c.Flow, &enableInt, &c.Up, &c.Down, &c.Total, &c.ExpiryTime, &c.SubID, &c.LastOnline); err != nil {
			return nil, err
		}
		c.Enable = enableInt == 1
		clients = append(clients, c)
	}
	return clients, nil
}

func (db *DB) GetClientsBySubID(subID string) ([]Client, error) {
	rows, err := db.conn.Query("SELECT id, inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id, last_online FROM clients WHERE sub_id = ?", subID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []Client
	for rows.Next() {
		var c Client
		var enableInt int
		if err := rows.Scan(&c.ID, &c.InboundID, &c.Email, &c.UUID, &c.Password, &c.Flow, &enableInt, &c.Up, &c.Down, &c.Total, &c.ExpiryTime, &c.SubID, &c.LastOnline); err != nil {
			return nil, err
		}
		c.Enable = enableInt == 1
		clients = append(clients, c)
	}
	return clients, nil
}

func (db *DB) GetClientByID(id int) (*Client, error) {
	row := db.conn.QueryRow("SELECT id, inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id, last_online FROM clients WHERE id = ?", id)
	var c Client
	var enableInt int
	if err := row.Scan(&c.ID, &c.InboundID, &c.Email, &c.UUID, &c.Password, &c.Flow, &enableInt, &c.Up, &c.Down, &c.Total, &c.ExpiryTime, &c.SubID, &c.LastOnline); err != nil {
		return nil, err
	}
	c.Enable = enableInt == 1
	return &c, nil
}

func (db *DB) GetClientByEmail(email string) (*Client, error) {
	row := db.conn.QueryRow("SELECT id, inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id, last_online FROM clients WHERE email = ?", email)
	var c Client
	var enableInt int
	if err := row.Scan(&c.ID, &c.InboundID, &c.Email, &c.UUID, &c.Password, &c.Flow, &enableInt, &c.Up, &c.Down, &c.Total, &c.ExpiryTime, &c.SubID, &c.LastOnline); err != nil {
		return nil, err
	}
	c.Enable = enableInt == 1
	return &c, nil
}

func (db *DB) SaveClient(c *Client) error {
	enableInt := 0
	if c.Enable {
		enableInt = 1
	}

	if c.ID == 0 {
		res, err := db.conn.Exec(`
			INSERT INTO clients(inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id, last_online)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, c.InboundID, c.Email, c.UUID, c.Password, c.Flow, enableInt, c.Up, c.Down, c.Total, c.ExpiryTime, c.SubID, c.LastOnline)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		c.ID = int(id)
		return nil
	}

	_, err := db.conn.Exec(`
		UPDATE clients SET email=?, uuid=?, password=?, flow=?, enable=?, up=?, down=?, total=?, expiry_time=?, sub_id=?, last_online=?
		WHERE id=?
	`, c.Email, c.UUID, c.Password, c.Flow, enableInt, c.Up, c.Down, c.Total, c.ExpiryTime, c.SubID, c.LastOnline, c.ID)
	return err
}

func (db *DB) DeleteClient(id int) error {
	_, err := db.conn.Exec("DELETE FROM clients WHERE id = ?", id)
	return err
}

func (db *DB) ResetTraffic(id int, email string) error {
	if id > 0 {
		_, err := db.conn.Exec("UPDATE clients SET up = 0, down = 0 WHERE id = ?", id)
		return err
	}
	if email != "" {
		_, err := db.conn.Exec("UPDATE clients SET up = 0, down = 0 WHERE email = ?", email)
		return err
	}
	return nil
}

func (db *DB) AddInboundTraffic(tag string, up, down int64) error {
	if up <= 0 && down <= 0 {
		return nil
	}
	_, err := db.conn.Exec("UPDATE inbounds SET up = up + ?, down = down + ? WHERE tag = ?", up, down, tag)
	return err
}

func (db *DB) AddClientTraffic(email string, up, down int64, now int64) error {
	if up <= 0 && down <= 0 {
		return nil
	}
	_, err := db.conn.Exec("UPDATE clients SET up = up + ?, down = down + ?, last_online = ? WHERE email = ?", up, down, now, email)
	return err
}

func (db *DB) UpdateClientsLastOnline(emails []string, now int64) error {
	if len(emails) == 0 {
		return nil
	}
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("UPDATE clients SET last_online = ? WHERE email = ?")
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, email := range emails {
		_, _ = stmt.Exec(now, email)
	}
	return tx.Commit()
}

// GetOnlineClientsFromDB returns all unique client emails that have been seen online within graceSec seconds
func (db *DB) GetOnlineClientsFromDB(graceSec int64) ([]string, error) {
	threshold := time.Now().Unix() - graceSec
	rows, err := db.conn.Query("SELECT DISTINCT email FROM clients WHERE last_online >= ?", threshold)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var emails []string
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err == nil && email != "" {
			emails = append(emails, email)
		}
	}
	return emails, nil
}

func (db *DB) AddTraffic(email string, up, down int64) error {
	return db.AddClientTraffic(email, up, down, time.Now().Unix())
}

func (db *DB) CheckClientExpiredOrDepleted(c *Client) bool {
	now := time.Now().Unix()
	if c.ExpiryTime > 0 && now > c.ExpiryTime {
		return true
	}
	if c.Total > 0 && (c.Up+c.Down) >= c.Total {
		return true
	}
	return false
}
