package logger

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// LogLevel represents severity level
type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelNotice
	LevelWarning
	LevelError
)

func (l LogLevel) String() string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelNotice:
		return "NOTICE"
	case LevelWarning:
		return "WARNING"
	case LevelError:
		return "ERROR"
	default:
		return "INFO"
	}
}

// ParseLevel parses level string
func ParseLevel(lvl string) LogLevel {
	switch strings.ToLower(strings.TrimSpace(lvl)) {
	case "debug":
		return LevelDebug
	case "info":
		return LevelInfo
	case "notice":
		return LevelNotice
	case "warning", "warn":
		return LevelWarning
	case "error", "err":
		return LevelError
	default:
		return LevelInfo
	}
}

const (
	maxBufferSize = 10000
	timeFormat    = "2006/01/02 15:04:05"
)

type logEntry struct {
	time  string
	level LogLevel
	text  string
}

var (
	bufferMu sync.RWMutex
	buffer   = make([]logEntry, 0, 1024)
)

func appendEntry(level LogLevel, msg string) {
	t := time.Now().Format(timeFormat)
	entry := logEntry{
		time:  t,
		level: level,
		text:  msg,
	}

	bufferMu.Lock()
	if len(buffer) >= maxBufferSize {
		// Drop oldest 10% to prevent excessive re-allocations
		drop := maxBufferSize / 10
		buffer = buffer[drop:]
	}
	buffer = append(buffer, entry)
	bufferMu.Unlock()

	// Print to stdout for console and systemd journalctl
	fmt.Printf("%s %s - %s\n", t, level.String(), msg)
}

// Log adds a log entry directly
func Log(levelStr string, msg string) {
	lvl := ParseLevel(levelStr)
	appendEntry(lvl, msg)
}

// Debug logs debug message
func Debug(args ...any) {
	appendEntry(LevelDebug, fmt.Sprint(args...))
}

// Debugf logs formatted debug message
func Debugf(format string, args ...any) {
	appendEntry(LevelDebug, fmt.Sprintf(format, args...))
}

// Info logs info message
func Info(args ...any) {
	appendEntry(LevelInfo, fmt.Sprint(args...))
}

// Infof logs formatted info message
func Infof(format string, args ...any) {
	appendEntry(LevelInfo, fmt.Sprintf(format, args...))
}

// Notice logs notice message
func Notice(args ...any) {
	appendEntry(LevelNotice, fmt.Sprint(args...))
}

// Noticef logs formatted notice message
func Noticef(format string, args ...any) {
	appendEntry(LevelNotice, fmt.Sprintf(format, args...))
}

// Warning logs warning message
func Warning(args ...any) {
	appendEntry(LevelWarning, fmt.Sprint(args...))
}

// Warningf logs formatted warning message
func Warningf(format string, args ...any) {
	appendEntry(LevelWarning, fmt.Sprintf(format, args...))
}

// Error logs error message
func Error(args ...any) {
	appendEntry(LevelError, fmt.Sprint(args...))
}

// Errorf logs formatted error message
func Errorf(format string, args ...any) {
	appendEntry(LevelError, fmt.Sprintf(format, args...))
}

// GetLogs returns formatted logs filtered by level up to count
func GetLogs(count int, minLevelStr string) []string {
	if count <= 0 {
		count = 20
	}
	if count > maxBufferSize {
		count = maxBufferSize
	}

	minLevel := ParseLevel(minLevelStr)

	bufferMu.RLock()
	snap := make([]logEntry, len(buffer))
	copy(snap, buffer)
	bufferMu.RUnlock()

	var output []string
	// Return most recent matching entries
	for i := len(snap) - 1; i >= 0 && len(output) < count; i-- {
		// In severity hierarchy: LevelDebug (0) <= LevelInfo (1) <= LevelNotice (2) <= LevelWarning (3) <= LevelError (4)
		// If user selects "Info" (1), they want Info, Notice, Warning, Error (>= 1).
		if snap[i].level >= minLevel {
			output = append(output, fmt.Sprintf("%s %s - %s", snap[i].time, snap[i].level.String(), snap[i].text))
		}
	}

	return output
}
