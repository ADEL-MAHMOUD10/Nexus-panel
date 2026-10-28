package xray

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"nexus/internal/logger"
)

var xrayLogRegex = regexp.MustCompile(`^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?) \[([^\]]+)\] (.+)$`)
var xrayAccessRegex = regexp.MustCompile(`(?i)(?:from\s+)?([\[\]0-9a-fA-F:.]+?)(?::\d+)?\s+accepted\s+.*email:\s*([^\s,\]]+)`)

func extractAccessEmailAndIP(line string) (string, string) {
	// 1. Regex check
	if accessMatches := xrayAccessRegex.FindStringSubmatch(line); len(accessMatches) >= 3 {
		rawIP := accessMatches[1]
		clientEmail := strings.TrimSpace(accessMatches[2])
		cleanIP := rawIP
		if h, _, err := net.SplitHostPort(rawIP); err == nil {
			cleanIP = h
		}
		cleanIP = strings.Trim(cleanIP, "[]")
		if clientEmail != "" {
			if cleanIP == "127.0.0.1" || cleanIP == "::1" {
				return clientEmail, ""
			}
			return clientEmail, cleanIP
		}
	}

	// 2. Token-by-token field scanner (identical to 3x-ui parseAccessLogFields)
	parts := strings.Fields(line)
	var fromAddr, foundEmail string
	for i, part := range parts {
		if part == "from" && i+1 < len(parts) {
			fromAddr = strings.TrimLeft(parts[i+1], "/")
		} else if part == "email:" && i+1 < len(parts) {
			foundEmail = parts[i+1]
		} else if strings.HasPrefix(part, "email:") && len(part) > 6 {
			foundEmail = strings.TrimPrefix(part, "email:")
		}
	}

	if foundEmail != "" {
		foundEmail = strings.Trim(foundEmail, "[],\"'")
		cleanIP := fromAddr
		if h, _, err := net.SplitHostPort(fromAddr); err == nil {
			cleanIP = h
		}
		cleanIP = strings.Trim(cleanIP, "[]")
		if cleanIP == "127.0.0.1" || cleanIP == "::1" {
			cleanIP = ""
		}
		return foundEmail, cleanIP
	}

	return "", ""
}


// XrayLogItem represents a structured log entry captured from Xray-core
type XrayLogItem struct {
	ID        int64  `json:"id"`
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"` // "debug", "info", "warning", "error", "access"
	Message   string `json:"message"`
	Raw       string `json:"raw"`
}

// ProcessManager manages the lifecycle of the Xray-core operating system process
type ProcessManager struct {
	mu         sync.RWMutex
	logMu      sync.Mutex
	binPath    string
	configPath string
	cmd        *exec.Cmd
	running    bool
	startTime  time.Time
	logs       []string
	logItems   []XrayLogItem
	logSeq     int64
	doneChan       chan struct{}
	logWriter      io.Writer
	onClientAccess func(email, ip string)
}

// SetOnClientAccess registers a callback invoked whenever Xray logs an accepted client connection
func (m *ProcessManager) SetOnClientAccess(fn func(email, ip string)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onClientAccess = fn
}

// NewProcessManager creates a new ProcessManager
func NewProcessManager(binPath, configPath string, logWriter io.Writer) *ProcessManager {
	if logWriter == nil {
		logWriter = os.Stdout
	}
	return &ProcessManager{
		binPath:    binPath,
		configPath: configPath,
		logWriter:  logWriter,
		logs:       make([]string, 0, 500),
		logItems:   make([]XrayLogItem, 0, 1000),
	}
}

// IsRunning reports whether the Xray process is currently alive
func (m *ProcessManager) IsRunning() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.running
}

// GetPid returns the operating system process ID if running, or 0
func (m *ProcessManager) GetPid() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.running || m.cmd == nil || m.cmd.Process == nil {
		return 0
	}
	return m.cmd.Process.Pid
}

// GetUptime returns how long Xray core has been running
func (m *ProcessManager) GetUptime() time.Duration {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.running || m.startTime.IsZero() {
		return 0
	}
	return time.Since(m.startTime)
}

// GetConfigPath returns the path to the config file
func (m *ProcessManager) GetConfigPath() string {
	return m.configPath
}

// GetBinPath returns the configured binary path
func (m *ProcessManager) GetBinPath() string {
	return m.binPath
}

// GetVersion queries the actual binary version installed on disk
func (m *ProcessManager) GetVersion() string {
	candidates := []string{}
	if m != nil && m.binPath != "" {
		candidates = append(candidates, m.binPath)
	}
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		candidates = append(candidates, filepath.Join(dir, "bin", "xray"), filepath.Join(dir, "xray"))
	}
	candidates = append(candidates,
		"/usr/local/nexus/bin/xray",
		"/usr/local/bin/xray",
		"/usr/bin/xray",
		"bin/xray",
	)

	for _, bin := range candidates {
		if bin == "" {
			continue
		}
		if runtime.GOOS == "windows" && !strings.HasSuffix(bin, ".exe") {
			bin += ".exe"
		}
		if fi, err := os.Stat(bin); err == nil && !fi.IsDir() {
			out, err := exec.Command(bin, "version").Output()
			if err == nil {
				lines := strings.Split(string(out), "\n")
				if len(lines) > 0 {
					parts := strings.Fields(lines[0])
					if len(parts) >= 2 {
						ver := parts[1]
						if !strings.HasPrefix(ver, "v") {
							ver = "v" + ver
						}
						return ver
					}
				}
			}
		}
	}

	if p, err := exec.LookPath("xray"); err == nil {
		out, err := exec.Command(p, "version").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			if len(lines) > 0 {
				parts := strings.Fields(lines[0])
				if len(parts) >= 2 {
					ver := parts[1]
					if !strings.HasPrefix(ver, "v") {
						ver = "v" + ver
					}
					return ver
				}
			}
		}
	}

	return "Not Installed"
}

// GetLogs returns the most recent logs
func (m *ProcessManager) GetLogs() []string {
	m.logMu.Lock()
	defer m.logMu.Unlock()
	result := make([]string, len(m.logs))
	copy(result, m.logs)
	return result
}

// GetFilteredLogs returns the most recent structured log items matching the filter, level, and count
func (m *ProcessManager) GetFilteredLogs(count int, filter string, level string) []XrayLogItem {
	m.logMu.Lock()
	defer m.logMu.Unlock()

	if count <= 0 {
		count = 100
	}
	if count > 2000 {
		count = 2000
	}

	filter = strings.ToLower(strings.TrimSpace(filter))
	level = strings.ToLower(strings.TrimSpace(level))

	var filtered []XrayLogItem
	for i := len(m.logItems) - 1; i >= 0; i-- {
		item := m.logItems[i]

		// Level check
		if level != "" && level != "all" {
			if strings.ToLower(item.Level) != level {
				continue
			}
		}

		// Filter substring check
		if filter != "" {
			combined := strings.ToLower(item.Raw + " " + item.Message + " " + item.Level)
			if !strings.Contains(combined, filter) {
				continue
			}
		}

		filtered = append(filtered, item)
		if len(filtered) >= count {
			break
		}
	}

	// Reverse to chronological order (oldest to newest)
	for i, j := 0, len(filtered)-1; i < j; i, j = i+1, j-1 {
		filtered[i], filtered[j] = filtered[j], filtered[i]
	}

	return filtered
}

// ClearLogs clears the in-memory log buffer
func (m *ProcessManager) ClearLogs() {
	m.logMu.Lock()
	defer m.logMu.Unlock()
	m.logs = make([]string, 0, 500)
	m.logItems = make([]XrayLogItem, 0, 1000)
}

func (m *ProcessManager) appendLog(s string) {
	m.logMu.Lock()
	defer m.logMu.Unlock()
	lines := strings.Split(strings.TrimRight(s, "\r\n"), "\n")
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if trimmed == "" {
			continue
		}

		// Check for Xray access log pattern to capture client handshake/connection in real time
		if clientEmail, cleanIP := extractAccessEmailAndIP(trimmed); clientEmail != "" {
			m.mu.RLock()
			cb := m.onClientAccess
			m.mu.RUnlock()
			if cb != nil {
				go cb(clientEmail, cleanIP)
			}
		}

		itemLevel := "info"
		itemMsg := trimmed
		nowStr := time.Now().Format("2006/01/02 15:04:05")

		// Parse structured Xray log lines: "2026/10/11 00:32:03 [Warning] msg..."
		matches := xrayLogRegex.FindStringSubmatch(trimmed)
		if len(matches) > 4 {
			lvl := strings.ToLower(matches[3])
			body := matches[4]
			bodyLower := strings.ToLower(body)
			itemMsg = body
			if matches[1] != "" {
				nowStr = matches[1]
			}

			if strings.Contains(bodyLower, "tls handshake error") || strings.Contains(bodyLower, "connection ends") {
				logger.Debug("XRAY: " + body)
				itemLevel = "debug"
			} else if strings.Contains(bodyLower, "failed") {
				logger.Error("XRAY: " + body)
				itemLevel = "error"
			} else {
				switch lvl {
				case "debug":
					logger.Debug("XRAY: " + body)
					itemLevel = "debug"
				case "info":
					logger.Info("XRAY: " + body)
					itemLevel = "info"
				case "warning", "warn":
					logger.Warning("XRAY: " + body)
					itemLevel = "warning"
				case "error", "err":
					logger.Error("XRAY: " + body)
					itemLevel = "error"
				case "access":
					itemLevel = "access"
				default:
					itemLevel = "info"
				}
			}
		} else {
			trimmedLower := strings.ToLower(trimmed)
			if strings.Contains(trimmedLower, "panic") || strings.Contains(trimmedLower, "fatal") || strings.Contains(trimmedLower, "failed to") {
				logger.Error("XRAY: " + trimmed)
				itemLevel = "error"
			} else if strings.Contains(trimmedLower, "warning") || strings.Contains(trimmedLower, "warn") {
				logger.Warning("XRAY: " + trimmed)
				itemLevel = "warning"
			} else if strings.Contains(trimmedLower, "accepted") || strings.Contains(trimmedLower, "proxy") {
				itemLevel = "access"
			} else {
				logger.Info("XRAY: " + trimmed)
				itemLevel = "info"
			}
		}

		m.logSeq++
		m.logItems = append(m.logItems, XrayLogItem{
			ID:        m.logSeq,
			Timestamp: nowStr,
			Level:     itemLevel,
			Message:   itemMsg,
			Raw:       trimmed,
		})
		if len(m.logItems) > 3000 {
			m.logItems = m.logItems[len(m.logItems)-3000:]
		}

		m.logs = append(m.logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), trimmed))
		if len(m.logs) > 3000 {
			m.logs = m.logs[len(m.logs)-3000:]
		}
	}
}

// Start launches the Xray-core binary with the configured configuration file
func (m *ProcessManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return fmt.Errorf("xray process is already running")
	}

	actualBinPath := m.binPath
	if _, err := os.Stat(actualBinPath); os.IsNotExist(err) {
		if runtime.GOOS == "windows" && !strings.HasSuffix(actualBinPath, ".exe") {
			if _, err := os.Stat(actualBinPath + ".exe"); err == nil {
				actualBinPath += ".exe"
			}
		}
		if _, err := os.Stat(actualBinPath); os.IsNotExist(err) {
			if looked, err := exec.LookPath(m.binPath); err == nil {
				actualBinPath = looked
			} else {
				return fmt.Errorf("xray binary not found at %s", m.binPath)
			}
		}
	}

	if _, err := os.Stat(m.configPath); os.IsNotExist(err) {
		return fmt.Errorf("xray config file not found at %s", m.configPath)
	}

	cmd := exec.CommandContext(context.Background(), actualBinPath, "-c", m.configPath)
	cmd.Dir = filepath.Dir(actualBinPath)
	pipe := &logPipe{pm: m}
	cmd.Stdout = pipe
	cmd.Stderr = pipe

	if err := cmd.Start(); err != nil {
		logger.Errorf("NEXUS: failed to start xray-core: %v", err)
		return fmt.Errorf("failed to start xray-core: %w", err)
	}

	m.cmd = cmd
	m.running = true
	m.startTime = time.Now()
	m.doneChan = make(chan struct{})
	logger.Infof("NEXUS: Xray-core service started successfully (PID: %d)", cmd.Process.Pid)

	go m.waitForExit(cmd, m.doneChan)

	return nil
}

type logPipe struct {
	pm *ProcessManager
}

func (p *logPipe) Write(b []byte) (n int, err error) {
	p.pm.appendLog(string(b))
	if p.pm.logWriter != nil {
		return p.pm.logWriter.Write(b)
	}
	return len(b), nil
}

func (m *ProcessManager) waitForExit(cmd *exec.Cmd, done chan struct{}) {
	defer close(done)

	err := cmd.Wait()

	m.mu.Lock()
	m.running = false
	m.startTime = time.Time{}
	m.cmd = nil
	m.mu.Unlock()

	if err != nil {
		logger.Errorf("NEXUS: Xray process exited with error: %v", err)
	} else {
		logger.Infof("NEXUS: Xray process exited cleanly")
	}
}

// Stop terminates the running Xray process
func (m *ProcessManager) Stop() error {
	m.mu.Lock()
	if !m.running || m.cmd == nil || m.cmd.Process == nil {
		m.mu.Unlock()
		return nil
	}

	proc := m.cmd.Process
	done := m.doneChan
	m.mu.Unlock()

	if runtime.GOOS == "windows" {
		_ = proc.Kill()
	} else {
		_ = proc.Signal(os.Interrupt)
	}

	select {
	case <-done:
		return nil
	case <-time.After(3 * time.Second):
		_ = proc.Kill()
		return nil
	}
}

// Restart cleanly restarts the Xray process
func (m *ProcessManager) Restart() error {
	_ = m.Stop()
	time.Sleep(200 * time.Millisecond)
	return m.Start()
}
