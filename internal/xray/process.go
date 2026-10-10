package xray

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

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
	doneChan   chan struct{}
	logWriter  io.Writer
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
		logs:       make([]string, 0, 200),
	}
}

// IsRunning reports whether the Xray process is currently alive
func (m *ProcessManager) IsRunning() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.running
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

// GetVersion queries the actual binary version
func (m *ProcessManager) GetVersion() string {
	bin := m.binPath
	if runtime.GOOS == "windows" && !strings.HasSuffix(bin, ".exe") {
		if _, err := os.Stat(bin + ".exe"); err == nil {
			bin += ".exe"
		}
	}
	out, err := exec.Command(bin, "version").Output()
	if err != nil {
		return "v26.7.11"
	}
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
	return "v26.7.11"
}

// GetLogs returns the most recent logs
func (m *ProcessManager) GetLogs() []string {
	m.logMu.Lock()
	defer m.logMu.Unlock()
	result := make([]string, len(m.logs))
	copy(result, m.logs)
	return result
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
		m.logs = append(m.logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), trimmed))
		if len(m.logs) > 200 {
			m.logs = m.logs[len(m.logs)-200:]
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
		m.appendLog(fmt.Sprintf("Failed to start xray-core: %v", err))
		return fmt.Errorf("failed to start xray-core: %w", err)
	}

	m.cmd = cmd
	m.running = true
	m.startTime = time.Now()
	m.doneChan = make(chan struct{})
	m.appendLog("Nexus Xray-core service started successfully")

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
		log.Printf("[Nexus Xray] Process exited with error: %v", err)
	} else {
		log.Printf("[Nexus Xray] Process exited cleanly")
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
