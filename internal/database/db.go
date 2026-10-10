package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
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
}

// DB wraps SQLite operations for Nexus
type DB struct {
	conn *sql.DB
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

	db := &DB{conn: conn}
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
		FOREIGN KEY(inbound_id) REFERENCES inbounds(id) ON DELETE CASCADE,
		UNIQUE(inbound_id, email)
	);
	CREATE INDEX IF NOT EXISTS idx_client_sub_id ON clients(sub_id);
	`
	if _, err := db.conn.Exec(schema); err != nil {
		return err
	}
	// Best-effort column additions for existing databases
	_, _ = db.conn.Exec("ALTER TABLE inbounds ADD COLUMN listen TEXT DEFAULT '0.0.0.0'")
	_, _ = db.conn.Exec("ALTER TABLE inbounds ADD COLUMN sniffing TEXT DEFAULT '{}'")
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

func (db *DB) DeleteInbound(id int) error {
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

	targetTransport := getInboundTransport(target.Protocol, target.StreamSettings)
	targetListen := normalizeListen(target.Listen)

	for _, existing := range inbounds {
		if ignoreID > 0 && existing.ID == ignoreID {
			continue
		}
		if existing.Port != target.Port {
			continue
		}

		existingTransport := getInboundTransport(existing.Protocol, existing.StreamSettings)
		// Check if L4 transport overlaps (TCP vs TCP or UDP vs UDP)
		if (targetTransport & existingTransport) == 0 {
			continue
		}

		// Check if listening IP interfaces overlap (0.0.0.0 overlaps everything, or identical specific IP)
		existingListen := normalizeListen(existing.Listen)
		if listenOverlaps(targetListen, existingListen) {
			return &existing, nil
		}
	}

	return nil, nil
}

type transportType uint8

const (
	transportTCP transportType = 1 << 0
	transportUDP transportType = 1 << 1
)

func getInboundTransport(protocol, streamSettings string) transportType {
	switch strings.ToLower(protocol) {
	case "hysteria", "hysteria2", "tuic", "wireguard", "amneziawg":
		return transportUDP
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
	case "kcp", "quic":
		return transportUDP
	default:
		return transportTCP
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
	rows, err := db.conn.Query("SELECT id, inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id FROM clients WHERE inbound_id = ?", inboundID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []Client
	for rows.Next() {
		var c Client
		var enableInt int
		if err := rows.Scan(&c.ID, &c.InboundID, &c.Email, &c.UUID, &c.Password, &c.Flow, &enableInt, &c.Up, &c.Down, &c.Total, &c.ExpiryTime, &c.SubID); err != nil {
			return nil, err
		}
		c.Enable = enableInt == 1
		clients = append(clients, c)
	}
	return clients, nil
}

func (db *DB) GetClientsBySubID(subID string) ([]Client, error) {
	rows, err := db.conn.Query("SELECT id, inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id FROM clients WHERE sub_id = ?", subID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []Client
	for rows.Next() {
		var c Client
		var enableInt int
		if err := rows.Scan(&c.ID, &c.InboundID, &c.Email, &c.UUID, &c.Password, &c.Flow, &enableInt, &c.Up, &c.Down, &c.Total, &c.ExpiryTime, &c.SubID); err != nil {
			return nil, err
		}
		c.Enable = enableInt == 1
		clients = append(clients, c)
	}
	return clients, nil
}

func (db *DB) SaveClient(c *Client) error {
	enableInt := 0
	if c.Enable {
		enableInt = 1
	}

	if c.ID == 0 {
		res, err := db.conn.Exec(`
			INSERT INTO clients(inbound_id, email, uuid, password, flow, enable, up, down, total, expiry_time, sub_id)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, c.InboundID, c.Email, c.UUID, c.Password, c.Flow, enableInt, c.Up, c.Down, c.Total, c.ExpiryTime, c.SubID)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		c.ID = int(id)
		return nil
	}

	_, err := db.conn.Exec(`
		UPDATE clients SET email=?, uuid=?, password=?, flow=?, enable=?, up=?, down=?, total=?, expiry_time=?, sub_id=?
		WHERE id=?
	`, c.Email, c.UUID, c.Password, c.Flow, enableInt, c.Up, c.Down, c.Total, c.ExpiryTime, c.SubID, c.ID)
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

func (db *DB) AddTraffic(email string, up, down int64) error {
	_, err := db.conn.Exec("UPDATE clients SET up = up + ?, down = down + ? WHERE email = ?", up, down, email)
	return err
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
