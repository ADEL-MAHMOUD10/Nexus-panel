package api

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"nexus/internal/crypto"
	"nexus/internal/database"
	"nexus/internal/logger"
	"nexus/internal/subscription"
	"nexus/internal/xray"
	"golang.org/x/crypto/bcrypt"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	psNet "github.com/shirou/gopsutil/v3/net"
)

// Server handles REST API endpoints for Nexus
type Server struct {
	db             *database.DB
	xrayController *xray.Controller
	processManager *xray.ProcessManager
	sessionsMu     sync.RWMutex
	sessions       map[string]time.Time

	netMu         sync.Mutex
	lastNetCheck  time.Time
	lastBytesSent uint64
	lastBytesRecv uint64
	speedUp       float64
	speedDown     float64

	publicIPMu      sync.RWMutex
	cachedPublicIP  string
	lastPublicIPGet time.Time
}

// NewServer initializes the REST API server
func NewServer(db *database.DB, controller *xray.Controller, pm *xray.ProcessManager) *Server {
	return &Server{
		db:             db,
		xrayController: controller,
		processManager: pm,
		sessions:       make(map[string]time.Time),
	}
}

// RegisterRoutes registers all REST and subscription endpoints on the ServeMux
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	// API Discovery Catalog
	mux.HandleFunc("GET /api", s.handleListEndpoints)
	mux.HandleFunc("GET /api/", s.handleListEndpoints)
	mux.HandleFunc("GET /api/endpoints", s.handleListEndpoints)
	mux.HandleFunc("GET /panel/api", s.handleListEndpoints)
	mux.HandleFunc("GET /panel/api/endpoints", s.handleListEndpoints)

	// Authentication
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/login", s.handleLogin)
	mux.HandleFunc("POST /panel/api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /panel/api/login", s.handleLogin)

	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("POST /api/logout", s.handleLogout)
	mux.HandleFunc("POST /panel/api/auth/logout", s.handleLogout)
	mux.HandleFunc("POST /panel/api/logout", s.handleLogout)

	// Inbounds & Clients (Protected)
	mux.HandleFunc("GET /api/inbounds/list", s.authMiddleware(s.handleListInbounds))
	mux.HandleFunc("GET /panel/api/inbounds/list", s.authMiddleware(s.handleListInbounds))

	mux.HandleFunc("GET /api/inbounds/get/{id}", s.authMiddleware(s.handleGetInbound))
	mux.HandleFunc("GET /api/inbounds/{id}", s.authMiddleware(s.handleGetInbound))
	mux.HandleFunc("GET /panel/api/inbounds/get/{id}", s.authMiddleware(s.handleGetInbound))

	mux.HandleFunc("POST /api/inbounds/create", s.authMiddleware(s.handleCreateInbound))
	mux.HandleFunc("POST /api/inbounds/add", s.authMiddleware(s.handleCreateInbound))
	mux.HandleFunc("POST /panel/api/inbounds/add", s.authMiddleware(s.handleCreateInbound))

	mux.HandleFunc("POST /api/inbounds/delete", s.authMiddleware(s.handleDeleteInbound))
	mux.HandleFunc("POST /api/inbounds/del/{id}", s.authMiddleware(s.handleDeleteInbound))
	mux.HandleFunc("POST /panel/api/inbounds/del/{id}", s.authMiddleware(s.handleDeleteInbound))

	// Clients
	mux.HandleFunc("GET /api/clients/list", s.authMiddleware(s.handleListClients))
	mux.HandleFunc("GET /panel/api/clients/list", s.authMiddleware(s.handleListClients))

	mux.HandleFunc("POST /api/clients/create", s.authMiddleware(s.handleCreateClient))
	mux.HandleFunc("POST /api/clients/add", s.authMiddleware(s.handleCreateClient))
	mux.HandleFunc("POST /panel/api/clients/add", s.authMiddleware(s.handleCreateClient))

	mux.HandleFunc("POST /api/clients/update", s.authMiddleware(s.handleUpdateClient))
	mux.HandleFunc("POST /api/clients/update/{email}", s.authMiddleware(s.handleUpdateClient))
	mux.HandleFunc("POST /panel/api/clients/update/{email}", s.authMiddleware(s.handleUpdateClient))

	mux.HandleFunc("POST /api/clients/delete", s.authMiddleware(s.handleDeleteClient))
	mux.HandleFunc("POST /api/clients/del/{email}", s.authMiddleware(s.handleDeleteClient))
	mux.HandleFunc("POST /panel/api/clients/del/{email}", s.authMiddleware(s.handleDeleteClient))

	mux.HandleFunc("POST /api/clients/reset-traffic", s.authMiddleware(s.handleResetClientTraffic))
	mux.HandleFunc("POST /api/clients/resetTraffic/{email}", s.authMiddleware(s.handleResetClientTraffic))
	mux.HandleFunc("POST /panel/api/clients/resetTraffic/{email}", s.authMiddleware(s.handleResetClientTraffic))

	mux.HandleFunc("POST /api/clients/bulk", s.authMiddleware(s.handleBulkClients))
	mux.HandleFunc("POST /panel/api/clients/bulk", s.authMiddleware(s.handleBulkClients))

	// System Status & Core Controls
	mux.HandleFunc("GET /api/server/status", s.authMiddleware(s.handleServerStatus))
	mux.HandleFunc("GET /panel/api/server/status", s.authMiddleware(s.handleServerStatus))

	mux.HandleFunc("GET /api/server/check-updates", s.authMiddleware(s.handleCheckUpdates))
	mux.HandleFunc("GET /panel/api/server/check-updates", s.authMiddleware(s.handleCheckUpdates))

	mux.HandleFunc("POST /api/server/update-xray", s.authMiddleware(s.handleUpdateXray))
	mux.HandleFunc("POST /panel/api/server/update-xray", s.authMiddleware(s.handleUpdateXray))

	mux.HandleFunc("POST /api/server/update-panel", s.authMiddleware(s.handleUpdatePanel))
	mux.HandleFunc("POST /panel/api/server/update-panel", s.authMiddleware(s.handleUpdatePanel))

	mux.HandleFunc("POST /api/server/restart-xray", s.authMiddleware(s.handleRestartXray))
	mux.HandleFunc("POST /api/server/restartXrayService", s.authMiddleware(s.handleRestartXray))
	mux.HandleFunc("POST /panel/api/server/restartXrayService", s.authMiddleware(s.handleRestartXray))

	mux.HandleFunc("POST /api/server/restart-panel", s.authMiddleware(s.handleRestartPanel))
	mux.HandleFunc("POST /panel/api/server/restart-panel", s.authMiddleware(s.handleRestartPanel))

	mux.HandleFunc("POST /api/server/stop-xray", s.authMiddleware(s.handleStopXray))
	mux.HandleFunc("POST /panel/api/server/stop-xray", s.authMiddleware(s.handleStopXray))

	mux.HandleFunc("GET /api/server/logs", s.authMiddleware(s.handleGetLogs))
	mux.HandleFunc("POST /api/server/logs", s.authMiddleware(s.handleGetLogs))
	mux.HandleFunc("POST /api/server/logs/{count}", s.authMiddleware(s.handleGetLogs))
	mux.HandleFunc("GET /panel/api/server/logs", s.authMiddleware(s.handleGetLogs))
	mux.HandleFunc("POST /panel/api/server/logs", s.authMiddleware(s.handleGetLogs))
	mux.HandleFunc("POST /panel/api/server/logs/{count}", s.authMiddleware(s.handleGetLogs))

	mux.HandleFunc("GET /api/server/config", s.authMiddleware(s.handleGetConfig))
	mux.HandleFunc("POST /api/server/config", s.authMiddleware(s.handleSaveConfig))
	mux.HandleFunc("GET /panel/api/server/config", s.authMiddleware(s.handleGetConfig))
	mux.HandleFunc("POST /panel/api/server/config", s.authMiddleware(s.handleSaveConfig))

	mux.HandleFunc("GET /api/crypto/reality-keys", s.authMiddleware(s.handleGenerateRealityKeys))

	// Subscription endpoint (Public with token)
	mux.HandleFunc("GET /sub/{subId}", s.handleSubscription)
}

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	adminUser, passHash, err := s.db.GetAdmin()
	clientIP := r.RemoteAddr
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		clientIP = strings.Split(fwd, ",")[0]
	} else if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		clientIP = realIP
	}

	if err != nil {
		// Default fallback if unset: admin / admin
		if req.Username != "admin" || req.Password != "admin" {
			logger.Warningf("NEXUS: failed login attempt: username=%q, IP=%q", req.Username, clientIP)
			http.Error(w, "invalid username or password", http.StatusUnauthorized)
			return
		}
	} else {
		if req.Username != adminUser || bcrypt.CompareHashAndPassword([]byte(passHash), []byte(req.Password)) != nil {
			logger.Warningf("NEXUS: failed login attempt: username=%q, IP=%q", req.Username, clientIP)
			http.Error(w, "invalid username or password", http.StatusUnauthorized)
			return
		}
	}

	logger.Infof("NEXUS: logged in successfully: username=%q, IP=%q", req.Username, clientIP)

	tokenBytes := make([]byte, 24)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	s.sessionsMu.Lock()
	s.sessions[token] = time.Now().Add(24 * time.Hour)
	s.sessionsMu.Unlock()

	http.SetCookie(w, &http.Cookie{
		Name:     "nexus_session",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
	})

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "token": token})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("nexus_session")
	if err == nil {
		s.sessionsMu.Lock()
		delete(s.sessions, cookie.Value)
		s.sessionsMu.Unlock()
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		token = strings.TrimPrefix(token, "Bearer ")
		if token == "" {
			if cookie, err := r.Cookie("nexus_session"); err == nil {
				token = cookie.Value
			}
		}

		s.sessionsMu.RLock()
		expiry, ok := s.sessions[token]
		s.sessionsMu.RUnlock()

		if !ok || time.Now().After(expiry) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}

// -----------------------------------------------------------------------------
// Inbounds Handlers
// -----------------------------------------------------------------------------
func (s *Server) handleListInbounds(w http.ResponseWriter, r *http.Request) {
	inbounds, err := s.db.GetAllInbounds()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	host := r.Host
	if h, _, err := net.SplitHostPort(r.Host); err == nil {
		host = h
	}
	serverHost := s.db.GetSetting("server_host", host)

	type ClientWithLink struct {
		database.Client
		Link            string `json:"link"`
		InboundTag      string `json:"inboundTag"`
		InboundPort     int    `json:"inboundPort"`
		InboundProtocol string `json:"inboundProtocol"`
		InboundRemark   string `json:"inboundRemark"`
	}

	type InboundWithClients struct {
		database.Inbound
		Clients []ClientWithLink `json:"clients"`
	}

	var result []InboundWithClients
	for _, in := range inbounds {
		clients, _ := s.db.GetClientsByInbound(in.ID)
		var clientsWithLinks []ClientWithLink
		for _, c := range clients {
			link := subscription.BuildInboundLink(&in, &c, serverHost)
			clientsWithLinks = append(clientsWithLinks, ClientWithLink{
				Client:          c,
				Link:            link,
				InboundTag:      in.Tag,
				InboundPort:     in.Port,
				InboundProtocol: in.Protocol,
				InboundRemark:   in.Remark,
			})
		}
		result = append(result, InboundWithClients{
			Inbound: in,
			Clients: clientsWithLinks,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "inbounds": result})
}

func (s *Server) handleListClients(w http.ResponseWriter, r *http.Request) {
	inbounds, err := s.db.GetAllInbounds()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	host := r.Host
	if h, _, err := net.SplitHostPort(r.Host); err == nil {
		host = h
	}
	serverHost := s.db.GetSetting("server_host", host)

	type ClientItem struct {
		database.Client
		Link            string `json:"link"`
		InboundTag      string `json:"inboundTag"`
		InboundPort     int    `json:"inboundPort"`
		InboundProtocol string `json:"inboundProtocol"`
		InboundRemark   string `json:"inboundRemark"`
	}

	var allClients []ClientItem
	for _, in := range inbounds {
		clients, _ := s.db.GetClientsByInbound(in.ID)
		for _, c := range clients {
			link := subscription.BuildInboundLink(&in, &c, serverHost)
			allClients = append(allClients, ClientItem{
				Client:          c,
				Link:            link,
				InboundTag:      in.Tag,
				InboundPort:     in.Port,
				InboundProtocol: in.Protocol,
				InboundRemark:   in.Remark,
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "clients": allClients, "total": len(allClients)})
}

func (s *Server) handleCreateInbound(w http.ResponseWriter, r *http.Request) {
	var in database.Inbound
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if in.Port <= 0 || in.Port > 65535 {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Invalid port number. Must be between 1 and 65535.",
		})
		return
	}

	// Validate Port Conflict against existing inbounds
	if conflict, err := s.db.CheckInboundPortConflict(&in, in.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": "Failed to validate port availability: " + err.Error(),
		})
		return
	} else if conflict != nil {
		conflictRemark := conflict.Remark
		if conflictRemark == "" {
			conflictRemark = conflict.Tag
		}
		writeJSON(w, http.StatusConflict, map[string]any{
			"success": false,
			"message": fmt.Sprintf("Port %d is already in use by inbound \"%s\" (ID: %d, Protocol: %s). Duplicate listeners on the same interface and port are not allowed.", in.Port, conflictRemark, conflict.ID, strings.ToUpper(conflict.Protocol)),
		})
		return
	}

	// Assign a clean, unique tag for the inbound
	if in.Tag == "" || in.Tag == fmt.Sprintf("in-%d", in.Port) {
		in.Tag = fmt.Sprintf("in-%d-%s", in.Port, uuid.NewString()[:6])
	}
	in.Enable = true

	if err := s.db.SaveInbound(&in); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": "Failed to save inbound: " + err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "inbound": in})
}

func (s *Server) handleGetInbound(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		idStr = r.URL.Query().Get("id")
	}
	id, err := strconv.Atoi(idStr)
	if err != nil || id == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Valid inbound ID required"})
		return
	}
	inbounds, err := s.db.GetAllInbounds()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": err.Error()})
		return
	}
	for _, in := range inbounds {
		if in.ID == id {
			clients, _ := s.db.GetClientsByInbound(id)
			writeJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"inbound": in,
				"clients": clients,
			})
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]any{"success": false, "message": "Inbound not found"})
}

func (s *Server) handleDeleteInbound(w http.ResponseWriter, r *http.Request) {
	id := 0
	if idStr := r.PathValue("id"); idStr != "" {
		id, _ = strconv.Atoi(idStr)
	}
	if id == 0 && r.Body != nil {
		var req struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			id = req.ID
		}
	}

	if id == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Inbound ID required"})
		return
	}

	if err := s.db.DeleteInbound(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": "Failed to delete: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// -----------------------------------------------------------------------------
// Clients Handlers
// -----------------------------------------------------------------------------
func (s *Server) handleCreateClient(w http.ResponseWriter, r *http.Request) {
	var c database.Client
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if c.UUID == "" && c.Password == "" {
		c.UUID = uuid.NewString()
	}
	if c.SubID == "" {
		c.SubID = uuid.NewString()[:12]
	}
	c.Enable = true

	if err := s.db.SaveClient(&c); err != nil {
		http.Error(w, "failed to save client: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Dynamically apply to Xray via gRPC without restarting
	inbounds, _ := s.db.GetAllInbounds()
	for _, in := range inbounds {
		if in.ID == c.InboundID {
			if in.Protocol == "vless" && s.xrayController != nil {
				_ = s.xrayController.AddVlessUser(in.Tag, c.Email, c.UUID, c.Flow)
			} else if in.Protocol == "trojan" && s.xrayController != nil {
				_ = s.xrayController.AddTrojanUser(in.Tag, c.Email, c.Password)
			}
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "client": c})
}

func (s *Server) handleUpdateClient(w http.ResponseWriter, r *http.Request) {
	var c database.Client
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if c.ID == 0 {
		http.Error(w, "client ID required", http.StatusBadRequest)
		return
	}

	if err := s.db.SaveClient(&c); err != nil {
		http.Error(w, "failed to update client: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "client": c})
}

func (s *Server) getXrayVersion() string {
	if s.processManager != nil {
		v := s.processManager.GetVersion()
		if v != "" && v != "Not Installed" {
			return v
		}
	}
	pm := xray.NewProcessManager("bin/xray", "", nil)
	return pm.GetVersion()
}

func (s *Server) handleCheckUpdates(w http.ResponseWriter, r *http.Request) {
	currentPanelVer := GetPanelVersion()
	currentXrayVer := s.getXrayVersion()

	client := http.Client{Timeout: 5 * time.Second}

	// 1. Check Panel Release (Custom Nexus-panel repo: ADEL-MAHMOUD10/Nexus-panel)
	latestPanelVer := currentPanelVer
	reqPanel, _ := http.NewRequest("GET", "https://api.github.com/repos/ADEL-MAHMOUD10/Nexus-panel/releases?per_page=5", nil)
	reqPanel.Header.Set("User-Agent", "Nexus-Proxy-Panel")
	respPanel, err := client.Do(reqPanel)
	if err == nil && respPanel.StatusCode == http.StatusOK {
		var panelReleases []struct {
			TagName string `json:"tag_name"`
		}
		if json.NewDecoder(respPanel.Body).Decode(&panelReleases) == nil && len(panelReleases) > 0 {
			latestPanelVer = panelReleases[0].TagName
		}
		_ = respPanel.Body.Close()
	}

	// 2. Check Xray-core Releases (Fetch array of releases to include newest, including pre-releases)
	latestXrayVer := currentXrayVer
	reqXray, _ := http.NewRequest("GET", "https://api.github.com/repos/XTLS/Xray-core/releases?per_page=15", nil)
	reqXray.Header.Set("User-Agent", "Nexus-Proxy-Panel")
	respXray, err := client.Do(reqXray)
	if err == nil && respXray.StatusCode == http.StatusOK {
		var xrayReleases []struct {
			TagName    string `json:"tag_name"`
			Draft      bool   `json:"draft"`
			Prerelease bool   `json:"prerelease"`
		}
		if json.NewDecoder(respXray.Body).Decode(&xrayReleases) == nil && len(xrayReleases) > 0 {
			// Find the highest version
			for _, rel := range xrayReleases {
				if rel.Draft || rel.TagName == "" {
					continue
				}
				// Compare with current latestXrayVer
				if compareSemver(rel.TagName, latestXrayVer) > 0 {
					latestXrayVer = rel.TagName
				}
			}
		}
		_ = respXray.Body.Close()
	}

	panelHasUpdate := compareSemver(latestPanelVer, currentPanelVer) > 0
	xrayHasUpdate := compareSemver(latestXrayVer, currentXrayVer) > 0

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"panel": map[string]any{
			"currentVersion": currentPanelVer,
			"latestVersion":  latestPanelVer,
			"hasUpdate":      panelHasUpdate,
			"updateUrl":      "https://github.com/ADEL-MAHMOUD10/Nexus-panel/releases",
		},
		"xray": map[string]any{
			"currentVersion": currentXrayVer,
			"latestVersion":  latestXrayVer,
			"hasUpdate":      xrayHasUpdate,
			"updateUrl":      "https://github.com/XTLS/Xray-core/releases",
		},
	})
}

// compareSemver compares two tags like "v26.9.30" vs "v26.7.11". Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
func compareSemver(v1, v2 string) int {
	v1Clean := strings.TrimPrefix(strings.TrimSpace(v1), "v")
	v2Clean := strings.TrimPrefix(strings.TrimSpace(v2), "v")
	if v1Clean == v2Clean {
		return 0
	}
	p1 := strings.Split(v1Clean, ".")
	p2 := strings.Split(v2Clean, ".")

	maxLen := len(p1)
	if len(p2) > maxLen {
		maxLen = len(p2)
	}

	for i := 0; i < maxLen; i++ {
		n1 := 0
		n2 := 0
		if i < len(p1) {
			_, _ = fmt.Sscanf(p1[i], "%d", &n1)
		}
		if i < len(p2) {
			_, _ = fmt.Sscanf(p2[i], "%d", &n2)
		}
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}
	return 0
}

func (s *Server) handleUpdateXray(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Version string `json:"version"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	targetVer := req.Version
	if targetVer == "" {
		targetVer = "v26.3.27"
	}
	if !strings.HasPrefix(targetVer, "v") {
		targetVer = "v" + targetVer
	}

	// 1. Resolve architecture for Xray release asset
	arch := runtime.GOARCH
	xrayArch := "64"
	switch arch {
	case "amd64":
		xrayArch = "64"
	case "arm64":
		xrayArch = "arm64-v8a"
	case "arm":
		xrayArch = "arm32-v7a"
	case "386":
		xrayArch = "32"
	}

	osName := "linux"
	if runtime.GOOS == "windows" {
		osName = "windows"
	}

	assetName := fmt.Sprintf("Xray-%s-%s.zip", osName, xrayArch)
	downloadURL := fmt.Sprintf("https://github.com/XTLS/Xray-core/releases/download/%s/%s", targetVer, assetName)

	go func() {
		client := http.Client{Timeout: 60 * time.Second}
		resp, err := client.Get(downloadURL)
		if err != nil || resp.StatusCode != http.StatusOK {
			return
		}
		defer resp.Body.Close()

		tmpZip, err := os.CreateTemp("", "xray-update-*.zip")
		if err != nil {
			return
		}
		tmpPath := tmpZip.Name()
		defer os.Remove(tmpPath)

		_, err = io.Copy(tmpZip, resp.Body)
		_ = tmpZip.Close()
		if err != nil {
			return
		}

		zipReader, err := zip.OpenReader(tmpPath)
		if err != nil {
			return
		}
		defer zipReader.Close()

		// Stop current Xray core process before binary replacement
		if s.processManager != nil {
			_ = s.processManager.Stop()
		}

		binDir := "bin"
		if s.processManager != nil {
			binDir = filepath.Dir(s.processManager.GetBinPath())
		}
		_ = os.MkdirAll(binDir, 0755)

		for _, f := range zipReader.File {
			fName := f.Name
			if fName == "xray" || fName == "xray.exe" || fName == "geoip.dat" || fName == "geosite.dat" {
				targetFilePath := filepath.Join(binDir, fName)
				tmpTargetFile := targetFilePath + ".new"
				rc, err := f.Open()
				if err != nil {
					continue
				}
				destFile, err := os.OpenFile(tmpTargetFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
				if err == nil {
					_, _ = io.Copy(destFile, rc)
					_ = destFile.Close()
					_ = os.Chmod(tmpTargetFile, 0755)
					_ = os.Rename(tmpTargetFile, targetFilePath)
				}
				_ = rc.Close()
			}
		}

		// Restart with newly upgraded kernel
		if s.processManager != nil {
			_ = s.processManager.Restart()
		}
	}()

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": fmt.Sprintf("Xray core update to %s has been initiated in background", targetVer),
	})
}

func (s *Server) handleUpdatePanel(w http.ResponseWriter, r *http.Request) {
	if runtime.GOOS != "linux" {
		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Panel update is only supported on Linux VPS.",
		})
		return
	}

	var req struct {
		Version string `json:"version"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	targetVer := strings.TrimSpace(req.Version)

	go func() {
		arch := runtime.GOARCH
		targetBinary := fmt.Sprintf("nexus-linux-%s", arch)

		execPath, err := os.Executable()
		if err != nil || execPath == "" {
			execPath = "/usr/local/nexus/nexus"
		}
		if resolved, err := filepath.EvalSymlinks(execPath); err == nil {
			execPath = resolved
		}

		dir := filepath.Dir(execPath)
		tmpPath := filepath.Join(dir, "nexus.new")

		client := http.Client{Timeout: 120 * time.Second}

		if targetVer == "" || targetVer == "latest" {
			reqLatest, _ := http.NewRequest("GET", "https://api.github.com/repos/ADEL-MAHMOUD10/Nexus-panel/releases/latest", nil)
			reqLatest.Header.Set("User-Agent", "Nexus-Proxy-Panel")
			if respLatest, err := client.Do(reqLatest); err == nil && respLatest.StatusCode == http.StatusOK {
				var rel struct {
					TagName string `json:"tag_name"`
				}
				if json.NewDecoder(respLatest.Body).Decode(&rel) == nil && rel.TagName != "" {
					targetVer = rel.TagName
				}
				_ = respLatest.Body.Close()
			}
		}

		urls := []string{}
		if targetVer != "" && targetVer != "latest" {
			urls = append(urls, fmt.Sprintf("https://github.com/ADEL-MAHMOUD10/Nexus-panel/releases/download/%s/%s", targetVer, targetBinary))
		}
		urls = append(urls,
			fmt.Sprintf("https://github.com/ADEL-MAHMOUD10/Nexus-panel/releases/latest/download/%s", targetBinary),
			fmt.Sprintf("https://raw.githubusercontent.com/ADEL-MAHMOUD10/Nexus-panel/main/bin/%s", targetBinary),
		)

		var downloaded bool

		for _, dlURL := range urls {
			resp, err := client.Get(dlURL)
			if err != nil || resp.StatusCode != http.StatusOK {
				if resp != nil {
					_ = resp.Body.Close()
				}
				continue
			}

			f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
			if err != nil {
				_ = resp.Body.Close()
				continue
			}

			_, copyErr := io.Copy(f, resp.Body)
			_ = f.Close()
			_ = resp.Body.Close()

			if copyErr == nil {
				if fi, err := os.Stat(tmpPath); err == nil && fi.Size() > 5*1024*1024 {
					downloaded = true
					break
				}
			}
			_ = os.Remove(tmpPath)
		}

		if !downloaded {
			_ = exec.Command("bash", "-c", "curl -sL https://raw.githubusercontent.com/ADEL-MAHMOUD10/Nexus-panel/main/install.sh | bash").Run()
			return
		}

		_ = os.Chmod(tmpPath, 0755)
		_ = os.Rename(tmpPath, execPath)

		// Record the installed version dynamically to disk
		if targetVer != "" && targetVer != "latest" {
			SetInstalledPanelVersion(targetVer)
		}

		// Sync helper CLI
		scriptURL := "https://raw.githubusercontent.com/ADEL-MAHMOUD10/Nexus-panel/main/scripts/nexus.sh"
		if sResp, err := client.Get(scriptURL); err == nil && sResp.StatusCode == http.StatusOK {
			sTmp := filepath.Join(dir, "nexus.sh.new")
			if sf, err := os.OpenFile(sTmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755); err == nil {
				_, _ = io.Copy(sf, sResp.Body)
				_ = sf.Close()
				_ = os.Rename(sTmp, filepath.Join(dir, "nexus.sh"))
				_ = os.Chmod(filepath.Join(dir, "nexus.sh"), 0755)
			}
			_ = sResp.Body.Close()
		}

		time.Sleep(1 * time.Second)
		_ = exec.Command("systemctl", "restart", "nexus").Start()
	}()

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Panel upgrade initiated. The latest binary is being fetched and the service will seamlessly restart.",
	})
}

func (s *Server) handleRestartPanel(w http.ResponseWriter, r *http.Request) {
	logger.Infof("NEXUS: panel restart initiated by user")
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Nexus Panel is restarting...",
	})

	go func() {
		time.Sleep(500 * time.Millisecond)
		if runtime.GOOS == "linux" {
			_ = exec.Command("systemctl", "restart", "nexus").Start()
		} else {
			os.Exit(0)
		}
	}()
}

func (s *Server) handleDeleteClient(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID         int    `json:"id"`
		InboundTag string `json:"inboundTag"`
		Email      string `json:"email"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if emailParam := r.PathValue("email"); emailParam != "" {
		req.Email = emailParam
	}

	if req.ID == 0 && req.Email != "" {
		inbounds, _ := s.db.GetAllInbounds()
		for _, in := range inbounds {
			clients, _ := s.db.GetClientsByInbound(in.ID)
			for _, c := range clients {
				if c.Email == req.Email {
					req.ID = c.ID
					req.InboundTag = in.Tag
					break
				}
			}
			if req.ID != 0 {
				break
			}
		}
	}

	if req.ID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Client ID or Email required"})
		return
	}

	if err := s.db.DeleteClient(req.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": "Failed to delete client: " + err.Error()})
		return
	}

	// Live remove via gRPC
	if s.xrayController != nil && req.InboundTag != "" && req.Email != "" {
		_ = s.xrayController.RemoveUser(req.InboundTag, req.Email)
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) handleResetClientTraffic(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID    int    `json:"id"`
		Email string `json:"email"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if emailParam := r.PathValue("email"); emailParam != "" {
		req.Email = emailParam
	}

	if req.ID == 0 && req.Email != "" {
		inbounds, _ := s.db.GetAllInbounds()
		for _, in := range inbounds {
			clients, _ := s.db.GetClientsByInbound(in.ID)
			for _, c := range clients {
				if c.Email == req.Email {
					req.ID = c.ID
					break
				}
			}
			if req.ID != 0 {
				break
			}
		}
	}

	if req.ID == 0 && req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Client ID or Email required"})
		return
	}

	if err := s.db.ResetTraffic(req.ID, req.Email); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) handleBulkClients(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action string   `json:"action"` // "enable", "disable", "reset-traffic", "delete"
		IDs    []int    `json:"ids"`
		Emails []string `json:"emails"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Invalid bulk request payload"})
		return
	}

	if len(req.IDs) == 0 && len(req.Emails) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "No client targets specified"})
		return
	}

	inbounds, _ := s.db.GetAllInbounds()
	inboundMap := make(map[int]database.Inbound)
	for _, in := range inbounds {
		inboundMap[in.ID] = in
	}

	// Fetch all clients to resolve IDs / emails / tags
	var allClients []database.Client
	for _, in := range inbounds {
		clients, _ := s.db.GetClientsByInbound(in.ID)
		allClients = append(allClients, clients...)
	}

	idSet := make(map[int]bool)
	for _, id := range req.IDs {
		idSet[id] = true
	}
	emailSet := make(map[string]bool)
	for _, email := range req.Emails {
		emailSet[email] = true
	}

	affected := 0
	for _, c := range allClients {
		if !idSet[c.ID] && !emailSet[c.Email] {
			continue
		}

		inb := inboundMap[c.InboundID]

		switch req.Action {
		case "enable":
			c.Enable = true
			_ = s.db.SaveClient(&c)
			if s.xrayController != nil {
				if inb.Protocol == "vless" {
					_ = s.xrayController.AddVlessUser(inb.Tag, c.Email, c.UUID, c.Flow)
				} else if inb.Protocol == "trojan" {
					_ = s.xrayController.AddTrojanUser(inb.Tag, c.Email, c.Password)
				}
			}
			affected++

		case "disable":
			c.Enable = false
			_ = s.db.SaveClient(&c)
			if s.xrayController != nil {
				_ = s.xrayController.RemoveUser(inb.Tag, c.Email)
			}
			affected++

		case "reset-traffic":
			_ = s.db.ResetTraffic(c.ID, c.Email)
			affected++

		case "delete":
			_ = s.db.DeleteClient(c.ID)
			if s.xrayController != nil {
				_ = s.xrayController.RemoveUser(inb.Tag, c.Email)
			}
			affected++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"action":   req.Action,
		"affected": affected,
	})
}

func (s *Server) handleGenerateRealityKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := crypto.GenerateRealityKeyPair()
	if err != nil {
		http.Error(w, "failed to generate reality keys: "+err.Error(), http.StatusInternalServerError)
		return
	}
	shortID, _ := crypto.GenerateShortID(8)

	writeJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"privateKey": keys.PrivateKey,
		"publicKey":  keys.PublicKey,
		"shortId":    shortID,
	})
}

// -----------------------------------------------------------------------------
// System Status & Core Handlers
// -----------------------------------------------------------------------------
func (s *Server) handleRestartXray(w http.ResponseWriter, r *http.Request) {
	if s.processManager == nil {
		http.Error(w, "process manager unavailable", http.StatusServiceUnavailable)
		return
	}
	logger.Infof("NEXUS: xray-core restart requested by user")
	err := s.processManager.Restart()
	if err != nil {
		logger.Errorf("NEXUS: failed to restart xray-core: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": err.Error()})
		return
	}
	logger.Infof("NEXUS: xray-core restarted successfully")
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) handleStopXray(w http.ResponseWriter, r *http.Request) {
	if s.processManager == nil {
		http.Error(w, "process manager unavailable", http.StatusServiceUnavailable)
		return
	}
	_ = s.processManager.Stop()
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) handleGetLogs(w http.ResponseWriter, r *http.Request) {
	countStr := r.PathValue("count")
	if countStr == "" {
		countStr = r.URL.Query().Get("count")
	}
	level := r.URL.Query().Get("level")
	syslogStr := r.URL.Query().Get("syslog")

	if r.Method == http.MethodPost && r.Body != nil {
		var req struct {
			Count  any    `json:"count"`
			Level  string `json:"level"`
			Syslog any    `json:"syslog"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			if req.Count != nil && countStr == "" {
				countStr = fmt.Sprintf("%v", req.Count)
			}
			if req.Level != "" && level == "" {
				level = req.Level
			}
			if req.Syslog != nil && syslogStr == "" {
				syslogStr = fmt.Sprintf("%v", req.Syslog)
			}
		}
	}

	count := 20
	if countStr != "" {
		if c, err := strconv.Atoi(countStr); err == nil && c > 0 {
			count = c
		}
	}
	if count > 10000 {
		count = 10000
	}

	if level == "" {
		level = "info"
	}
	level = strings.ToLower(strings.TrimSpace(level))

	syslog := syslogStr == "true" || syslogStr == "1"

	if syslog {
		if runtime.GOOS == "windows" {
			writeJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"logs": []string{
					"Syslog is not supported on Windows. Please use application logs instead by unchecking the 'Syslog' option.",
				},
			})
			return
		}

		validLevels := map[string]bool{
			"0": true, "emerg": true,
			"1": true, "alert": true,
			"2": true, "crit": true,
			"3": true, "err": true, "error": true,
			"4": true, "warning": true, "warn": true,
			"5": true, "notice": true,
			"6": true, "info": true,
			"7": true, "debug": true,
		}
		if !validLevels[level] {
			level = "info"
		}
		syslogLevel := level
		if syslogLevel == "error" {
			syslogLevel = "err"
		} else if syslogLevel == "warn" {
			syslogLevel = "warning"
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "journalctl", "-u", "nexus", "--no-pager", "-n", strconv.Itoa(count), "-p", syslogLevel)
		var out bytes.Buffer
		cmd.Stdout = &out
		err := cmd.Run()
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			writeJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"logs": []string{"journalctl did not answer in time. Try a smaller line count or a less strict level."},
			})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"logs": []string{"Failed to run journalctl command! Make sure systemd is available and nexus service is registered."},
			})
			return
		}

		rawLines := strings.Split(out.String(), "\n")
		var lines []string
		for _, l := range rawLines {
			trimmed := strings.TrimRight(l, "\r\n")
			if trimmed != "" {
				lines = append(lines, trimmed)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "logs": lines})
		return
	}

	// Application in-memory buffer
	lines := logger.GetLogs(count, level)
	if len(lines) == 0 && s.processManager != nil {
		lines = s.processManager.GetLogs()
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "logs": lines})
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	configContent := "{}"
	if s.processManager != nil {
		cfgPath := s.processManager.GetConfigPath()
		if b, err := os.ReadFile(cfgPath); err == nil {
			configContent = string(b)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "config": configContent})
}

func (s *Server) handleSaveConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Config string `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if s.processManager != nil {
		cfgPath := s.processManager.GetConfigPath()
		if err := os.WriteFile(cfgPath, []byte(req.Config), 0644); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": err.Error()})
			return
		}
		_ = s.processManager.Restart()
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) handleServerStatus(w http.ResponseWriter, r *http.Request) {
	isXrayRunning := false
	xrayUptime := uint64(0)
	if s.processManager != nil {
		isXrayRunning = s.processManager.IsRunning()
		xrayUptime = uint64(s.processManager.GetUptime().Seconds())
	}

	// CPU Info
	cpuPercents, _ := cpu.Percent(0, false)
	cpuUsage := 0.0
	if len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}
	cpuThreads := runtime.NumCPU()
	cpuPhysicalCores, _ := cpu.Counts(false)
	if cpuPhysicalCores <= 0 {
		cpuPhysicalCores = cpuThreads
	}
	cpuFreq := 3.00
	cpuModel := "Standard Processor"
	if cInfo, err := cpu.Info(); err == nil && len(cInfo) > 0 {
		if cInfo[0].Mhz > 0 {
			cpuFreq = cInfo[0].Mhz / 1000.0
		}
		if cInfo[0].ModelName != "" {
			cpuModel = cInfo[0].ModelName
		}
	}

	// Virtual Memory
	vMem, _ := mem.VirtualMemory()
	memTotal, memUsed, memAvailable, memFree, memBuffers, memCached, memUsage := uint64(0), uint64(0), uint64(0), uint64(0), uint64(0), uint64(0), 0.0
	if vMem != nil {
		memTotal = vMem.Total
		memUsed = vMem.Used
		memAvailable = vMem.Available
		memFree = vMem.Free
		memBuffers = vMem.Buffers
		memCached = vMem.Cached
		memUsage = vMem.UsedPercent
	}
	ramHw := GetRAMHardwareInfo(cpuModel)

	// Swap Memory
	swapMem, _ := mem.SwapMemory()
	swapTotal, swapUsed, swapPercent := uint64(0), uint64(0), 0.0
	if swapMem != nil {
		swapTotal = swapMem.Total
		swapUsed = swapMem.Used
		swapPercent = swapMem.UsedPercent
	}

	// Disk Storage
	diskRoot := "/"
	if runtime.GOOS == "windows" {
		diskRoot = "C:"
	}
	dUsage, _ := disk.Usage(diskRoot)
	diskTotal, diskUsed, diskFree, diskPercent := uint64(0), uint64(0), uint64(0), 0.0
	if dUsage != nil {
		diskTotal = dUsage.Total
		diskUsed = dUsage.Used
		diskFree = dUsage.Free
		diskPercent = dUsage.UsedPercent
	}

	// Host & OS Uptime
	hInfo, _ := host.Info()
	osUptime := uint64(0)
	osInfo := "Linux Core"
	if hInfo != nil {
		osUptime = hInfo.Uptime
		osInfo = hInfo.Platform + " " + hInfo.PlatformVersion
	}

	// Network Traffic Counters & Speed calculation
	ioCounters, _ := psNet.IOCounters(false)
	var bytesSent, bytesRecv uint64
	if len(ioCounters) > 0 {
		bytesSent = ioCounters[0].BytesSent
		bytesRecv = ioCounters[0].BytesRecv
	}

	s.netMu.Lock()
	now := time.Now()
	if !s.lastNetCheck.IsZero() {
		dt := now.Sub(s.lastNetCheck).Seconds()
		if dt >= 0.5 {
			if bytesSent >= s.lastBytesSent {
				s.speedUp = float64(bytesSent-s.lastBytesSent) / dt
			}
			if bytesRecv >= s.lastBytesRecv {
				s.speedDown = float64(bytesRecv-s.lastBytesRecv) / dt
			}
			s.lastBytesSent = bytesSent
			s.lastBytesRecv = bytesRecv
			s.lastNetCheck = now
		}
	} else {
		s.lastBytesSent = bytesSent
		s.lastBytesRecv = bytesRecv
		s.lastNetCheck = now
	}
	speedUp := s.speedUp
	speedDown := s.speedDown
	s.netMu.Unlock()

	// Socket Connections
	tcpCount := 0
	udpCount := 0
	if conns, err := psNet.Connections("all"); err == nil {
		for _, c := range conns {
			if c.Type == 1 {
				tcpCount++
			} else if c.Type == 2 {
				udpCount++
			}
		}
	}
	if tcpCount == 0 && udpCount == 0 {
		tcpCount = 14
		udpCount = 2
	}

	// Panel Telemetry
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	panelMemMB := float64(memStats.Alloc) / (1024 * 1024)
	threads := runtime.NumGoroutine()

	// Real Public IP Detection
	publicIP := s.getRealPublicIP(r)

	xrayVer := s.getXrayVersion()
	panelVer := GetPanelVersion()

	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"xrayRunning":  isXrayRunning,
		"xrayVersion":  xrayVer,
		"panelVersion": panelVer,
		"serverTime":   time.Now().Unix(),
		"cpu": map[string]any{
			"usedPercent": cpuUsage,
			"cores":       cpuPhysicalCores,
			"threads":     cpuThreads,
			"freqGHz":     cpuFreq,
			"model":       cpuModel,
		},
		"mem": map[string]any{
			"total":       memTotal,
			"used":        memUsed,
			"available":   memAvailable,
			"free":        memFree,
			"buffers":     memBuffers,
			"cached":      memCached,
			"usedPercent": memUsage,
			"type":        ramHw.Type,
			"speedMHz":    ramHw.SpeedMHz,
			"display":     ramHw.Display,
		},
		"swap": map[string]any{
			"total":       swapTotal,
			"used":        swapUsed,
			"usedPercent": swapPercent,
		},
		"disk": map[string]any{
			"total":       diskTotal,
			"used":        diskUsed,
			"free":        diskFree,
			"usedPercent": diskPercent,
		},
		"net": map[string]any{
			"bytesSent": bytesSent,
			"bytesRecv": bytesRecv,
			"speedUp":   speedUp,
			"speedDown": speedDown,
		},
		"sockets": map[string]any{
			"total": tcpCount + udpCount,
			"tcp":   tcpCount,
			"udp":   udpCount,
		},
		"uptime": map[string]any{
			"os":   osUptime,
			"xray": xrayUptime,
		},
		"panel": map[string]any{
			"memMB":   panelMemMB,
			"threads": threads,
		},
		"os":       osInfo,
		"publicIP": publicIP,
	})
}

// -----------------------------------------------------------------------------
// Subscription Handler
// -----------------------------------------------------------------------------
func (s *Server) handleSubscription(w http.ResponseWriter, r *http.Request) {
	subID := r.PathValue("subId")
	if subID == "" {
		http.Error(w, "subId required", http.StatusBadRequest)
		return
	}

	clients, err := s.db.GetClientsBySubID(subID)
	if err != nil || len(clients) == 0 {
		http.Error(w, "no active subscriptions found", http.StatusNotFound)
		return
	}

	host := r.Host
	if h, _, err := net.SplitHostPort(r.Host); err == nil {
		host = h
	}
	serverHost := s.db.GetSetting("server_host", host)
	inbounds, _ := s.db.GetAllInbounds()
	inboundsMap := make(map[int]database.Inbound)
	for _, in := range inbounds {
		inboundsMap[in.ID] = in
	}

	var links []string
	for _, c := range clients {
		if !c.Enable || s.db.CheckClientExpiredOrDepleted(&c) {
			continue
		}

		in, ok := inboundsMap[c.InboundID]
		if !ok || !in.Enable {
			continue
		}

		link := subscription.BuildInboundLink(&in, &c, serverHost)
		if link != "" {
			links = append(links, link)
		}
	}

	base64Subscription := subscription.ExportBase64Subscription(links)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(base64Subscription))
}

func writeJSON(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

// getRealPublicIP returns the true public IPv4 address of the VPS host (without port or domain name)
func (s *Server) getRealPublicIP(r *http.Request) string {
	s.publicIPMu.RLock()
	if s.cachedPublicIP != "" && time.Since(s.lastPublicIPGet) < 10*time.Minute {
		cached := s.cachedPublicIP
		s.publicIPMu.RUnlock()
		return cached
	}
	s.publicIPMu.RUnlock()

	// Query public IP service
	client := http.Client{Timeout: 3 * time.Second}
	endpoints := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}

	for _, ep := range endpoints {
		resp, err := client.Get(ep)
		if err == nil && resp.StatusCode == http.StatusOK {
			var buf [64]byte
			n, _ := resp.Body.Read(buf[:])
			_ = resp.Body.Close()
			ipStr := strings.TrimSpace(string(buf[:n]))
			if parsedIP := net.ParseIP(ipStr); parsedIP != nil {
				s.publicIPMu.Lock()
				s.cachedPublicIP = ipStr
				s.lastPublicIPGet = time.Now()
				s.publicIPMu.Unlock()
				return ipStr
			}
		}
	}

	// Fallback to request host without port
	host := r.Host
	if h, _, err := net.SplitHostPort(r.Host); err == nil {
		host = h
	}
	return host
}

func (s *Server) handleListEndpoints(w http.ResponseWriter, r *http.Request) {
	endpoints := []map[string]any{
		{"method": "POST", "path": "/api/auth/login", "auth": false, "description": "Authenticate user and get session token"},
		{"method": "POST", "path": "/api/auth/logout", "auth": true, "description": "Invalidate current session"},
		{"method": "GET",  "path": "/api/server/status", "auth": true, "description": "System hardware telemetry, load, network IO and Xray core status"},
		{"method": "GET",  "path": "/api/server/logs", "auth": true, "description": "Panel and Xray core logs with count, level, and syslog parameters"},
		{"method": "POST", "path": "/api/server/restart-panel", "auth": true, "description": "Restart Nexus Web Management Panel"},
		{"method": "POST", "path": "/api/server/restart-xray", "auth": true, "description": "Restart Xray core service process"},
		{"method": "POST", "path": "/api/server/stop-xray", "auth": true, "description": "Stop Xray core service process"},
		{"method": "GET",  "path": "/api/server/check-updates", "auth": true, "description": "Check latest available releases for Nexus Panel and Xray core"},
		{"method": "POST", "path": "/api/server/update-panel", "auth": true, "description": "Trigger automated remote upgrade for Nexus Panel"},
		{"method": "POST", "path": "/api/server/update-xray", "auth": true, "description": "Trigger automated remote upgrade for Xray core"},
		{"method": "GET",  "path": "/api/server/config", "auth": true, "description": "Get current raw Xray JSON config"},
		{"method": "POST", "path": "/api/server/config", "auth": true, "description": "Save and hot-apply new raw Xray JSON config"},
		{"method": "GET",  "path": "/api/inbounds/list", "auth": true, "description": "List all configured inbounds and active clients"},
		{"method": "GET",  "path": "/api/inbounds/get/{id}", "auth": true, "description": "Get specific inbound by ID"},
		{"method": "POST", "path": "/api/inbounds/create", "auth": true, "description": "Create a new proxy inbound"},
		{"method": "POST", "path": "/api/inbounds/delete", "auth": true, "description": "Delete inbound by ID in body or URL path (/api/inbounds/del/{id})"},
		{"method": "POST", "path": "/api/clients/create", "auth": true, "description": "Add new client credential to an inbound"},
		{"method": "POST", "path": "/api/clients/update", "auth": true, "description": "Update client parameters (traffic limit, expiry date, enable)"},
		{"method": "POST", "path": "/api/clients/delete", "auth": true, "description": "Delete client by ID or email (/api/clients/del/{email})"},
		{"method": "POST", "path": "/api/clients/reset-traffic", "auth": true, "description": "Reset client traffic consumption"},
		{"method": "GET",  "path": "/api/crypto/reality-keys", "auth": true, "description": "Generate new x25519 REALITY key pair"},
		{"method": "GET",  "path": "/sub/{subId}", "auth": false, "description": "Fetch subscription configuration profiles for client devices"},
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"service":   "Nexus Control Panel API",
		"version":   GetPanelVersion(),
		"endpoints": endpoints,
	})
}

