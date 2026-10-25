package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"nexus/internal/logger"
)

type statusResponseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int64
}

func (w *statusResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusResponseWriter) Write(b []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytesWritten += int64(n)
	return n, err
}

// SecurityHeaders applies enterprise-grade HTTP security headers to all responses
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("X-DNS-Prefetch-Control", "off")

		// Strip potential fingerprinting headers
		w.Header().Del("Server")
		w.Header().Del("X-Powered-By")

		next.ServeHTTP(w, r)
	})
}

// PanicRecovery gracefully intercepts runtime panics and returns structured JSON errors
func PanicRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				stack := string(debug.Stack())
				logger.Errorf("[PanicRecovery] CRITICAL EXCEPTION on %s %s: %v\nStack: %s", r.Method, r.URL.Path, rec, stack)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"success": false,
					"message": "Internal Server Error: Unexpected system exception occurred",
					"error":   fmt.Sprintf("%v", rec),
				})
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// RequestLogger logs incoming HTTP telemetry with method, route, status, latency, and client IP
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		clientIP := r.RemoteAddr
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			clientIP = strings.Split(fwd, ",")[0]
		} else if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
			clientIP = realIP
		}

		wrapped := &statusResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)

		// Filter noisy recurring metrics/telemetry polling from spamming logs unless in debug mode
		isPolling := strings.Contains(r.URL.Path, "xraymetrics") || strings.Contains(r.URL.Path, "/check-updates") || strings.HasPrefix(r.URL.Path, "/assets/")
		if isPolling {
			logger.Debugf("[HTTP] %s %s %d %s [%s]", r.Method, r.URL.Path, wrapped.statusCode, duration, clientIP)
		} else {
			logger.Infof("[HTTP] %s %s %d %s [%s]", r.Method, r.URL.Path, wrapped.statusCode, duration, clientIP)
		}
	})
}
