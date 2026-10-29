package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"nexus/internal/api"
	"nexus/internal/database"
	"nexus/internal/logger"
	"nexus/internal/xray"
	"nexus/web"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	showVersion := flag.Bool("v", false, "Display Nexus Panel version")
	showVersionLong := flag.Bool("version", false, "Display Nexus Panel version")
	isCLI := flag.Bool("cli", false, "Execute CLI command and exit")
	setPort := flag.Int("set-port", 0, "Set web panel port")
	daemonPort := flag.Int("port", 0, "Web panel listening port (overrides database setting)")
	resetAdmin := flag.Bool("reset-admin", false, "Reset admin username and password")
	username := flag.String("username", "", "Admin username")
	password := flag.String("password", "", "Admin password")
	flag.Parse()

	if *showVersion || *showVersionLong {
		fmt.Printf("Nexus Panel %s (%s/%s)\n", api.GetPanelVersion(), runtime.GOOS, runtime.GOARCH)
		return
	}

	// Resolve storage paths
	baseDir := "."
	if exePath, err := os.Executable(); err == nil {
		baseDir = filepath.Dir(exePath)
	}

	dbPath := filepath.Join(baseDir, "data", "nexus.db")
	db, err := database.Open(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// -------------------------------------------------------------------------
	// CLI Commands Handlers (Called by nexus.sh)
	// -------------------------------------------------------------------------
	if *isCLI {
		if *setPort > 0 {
			if err := db.SetSetting("web_port", fmt.Sprintf("%d", *setPort)); err != nil {
				log.Fatalf("Failed to update port: %v", err)
			}
			fmt.Printf("Port updated to %d successfully\n", *setPort)
			return
		}

		if *resetAdmin {
			if *username == "" || *password == "" {
				log.Fatalf("Username and password are required")
			}
			hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
			if err != nil {
				log.Fatalf("Failed to hash password: %v", err)
			}
			if err := db.SetAdmin(*username, string(hash)); err != nil {
				log.Fatalf("Failed to save admin credentials: %v", err)
			}
			fmt.Printf("Admin credentials updated for user %s successfully\n", *username)
			return
		}
		return
	}

	// -------------------------------------------------------------------------
	// Panel Daemon Server
	// -------------------------------------------------------------------------
	fmt.Println("==================================================")
	fmt.Println("             Starting Nexus Panel Daemon          ")
	fmt.Println("==================================================")

	binPath := filepath.Join(baseDir, "bin", "xray")
	if runtime.GOOS == "windows" {
		binPath += ".exe"
	}
	if _, err := os.Stat(binPath); os.IsNotExist(err) {
		if p, err := exec.LookPath("xray"); err == nil {
			binPath = p
		} else if p, err := exec.LookPath("xray.exe"); err == nil {
			binPath = p
		}
	}

	configPath := filepath.Join(baseDir, "bin", "config.json")
	apiPort := 62789

	// Build and sync full Xray config from database
	if err := xray.SaveAndApplyConfig(db, apiPort, configPath, nil); err != nil {
		logger.Warningf("NEXUS: failed to generate Xray config from database, falling back to base config: %v", err)
		baseCfg := xray.DefaultBaseConfig(apiPort)
		cfgData, _ := baseCfg.ToJSON()
		_ = os.WriteFile(configPath, cfgData, 0644)
	}

	// Start Xray Core Process
	pm := xray.NewProcessManager(binPath, configPath, os.Stdout)
	if err := pm.Start(); err != nil {
		logger.Warningf("NEXUS: failed to start xray core binary (expected if running without binary locally): %v", err)
	} else {
		logger.Infof("NEXUS: xray core process started successfully")
	}
	defer pm.Stop()

	// Connect gRPC Controller
	grpcAddr := fmt.Sprintf("127.0.0.1:%d", apiPort)
	ctrl, err := xray.NewController(grpcAddr)
	if err != nil {
		logger.Warningf("NEXUS: failed to initialize Xray controller: %v", err)
	} else {
		defer ctrl.Close()
	}

	// Initialize REST API Server & Geo Engine early so background workers can record IPs
	apiServer := api.NewServer(db, ctrl, pm)

	// Background Traffic & Online Monitoring Worker (every 2.5 seconds for responsive real-time speed & online tracking)
	go func() {
		ticker := time.NewTicker(2500 * time.Millisecond)
		defer ticker.Stop()
		lastTickTime := time.Now()

		for range ticker.C {
			if ctrl == nil {
				continue
			}

			nowTime := time.Now()
			dt := nowTime.Sub(lastTickTime).Seconds()
			if dt <= 0 {
				dt = 2.5
			}
			lastTickTime = nowTime

			now := nowTime.Unix()
			activeEmailsMap := make(map[string]bool)
			var activeThisTick []string

			// 1. Query live traffic deltas from Xray core
			inboundTraffics, clientTraffics, onlineStatsUsers, err := ctrl.GetTraffic()
			if err != nil {
				logger.Debugf("[Traffic] Failed to query stats: %v", err)
			} else {
				for _, email := range onlineStatsUsers {
					if email != "" {
						activeEmailsMap[email] = true
					}
				}

				// Record inbound traffic deltas & compute real-time throughput
				var activeInboundsThisTick []string
				for _, inb := range inboundTraffics {
					if inb.Up > 0 || inb.Down > 0 {
						_ = db.AddInboundTraffic(inb.Tag, inb.Up, inb.Down)
						ctrl.UpdateInboundSpeed(inb.Tag, inb.Up, inb.Down, dt)
						activeInboundsThisTick = append(activeInboundsThisTick, inb.Tag)
					}
				}
				ctrl.DecayInboundSpeeds(activeInboundsThisTick)

				// Record client traffic deltas & compute real-time transfer rates
				for _, ct := range clientTraffics {
					if ct.Up > 0 || ct.Down > 0 {
						activeEmailsMap[ct.Email] = true
						activeThisTick = append(activeThisTick, ct.Email)
						_ = db.AddClientTraffic(ct.Email, ct.Up, ct.Down, now)
						ctrl.UpdateClientSpeed(ct.Email, ct.Up, ct.Down, dt)
					}
				}
			}

			// Decay speeds for clients with zero traffic this cycle
			ctrl.DecayClientSpeeds(activeThisTick)

			// 2. Query currently connected users & client source IPs from Xray (StatsUserOnline)
			onlineUsers, userIPs, err := ctrl.GetOnlineUsersWithIPs()
			if err != nil {
				logger.Debugf("[OnlineUsers] Notice: %v", err)
			} else {
				for _, email := range onlineUsers {
					if email != "" {
						activeEmailsMap[email] = true
					}
				}
				for email, ip := range userIPs {
					if email != "" && ip != "" {
						apiServer.RecordClientIP(email, ip)
					}
				}
			}

			// 3. Union active emails list
			var activeEmails []string
			for email := range activeEmailsMap {
				activeEmails = append(activeEmails, email)
			}

			// 4. Refresh in-memory online cache (90s grace period) & persist last_online
			ctrl.RefreshOnline(activeEmails, now, 90)
			if len(activeEmails) > 0 {
				_ = db.UpdateClientsLastOnline(activeEmails, now)
			}

			// 5. Check client quotas and expirations
			inbounds, _ := db.GetAllInbounds()
			for _, in := range inbounds {
				clients, _ := db.GetClientsByInbound(in.ID)
				for _, c := range clients {
					if c.Enable && db.CheckClientExpiredOrDepleted(&c) {
						logger.Warningf("[Quota] Client %s exceeded quota or expired. Disconnecting...", c.Email)
						_ = ctrl.RemoveUser(in.Tag, c.Email)
						c.Enable = false
						_ = db.SaveClient(&c)
					}
				}
			}
		}
	}()

	// Determine Web Panel listening port with priority: CLI flag > ENV > Database > Default
	webPort := db.GetSetting("web_port", "8443")
	if *daemonPort > 0 {
		webPort = fmt.Sprintf("%d", *daemonPort)
	} else if envPort := os.Getenv("NEXUS_PORT"); envPort != "" {
		webPort = envPort
	} else if envPort := os.Getenv("PORT"); envPort != "" {
		webPort = envPort
	}
	mux := http.NewServeMux()
	apiServer.RegisterRoutes(mux)

	// Serve Embedded Assets with Cache-Control headers
	fileServer := web.FileServerHandler()
	mux.Handle("/assets/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		fileServer.ServeHTTP(w, r)
	}))

	// Panel SPA UI Page Renderer
	serveUI := func(w http.ResponseWriter, r *http.Request) {
		htmlBytes, err := web.GetIndexHTML()
		if err != nil {
			http.Error(w, "Failed to load dashboard UI", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		_, _ = w.Write(htmlBytes)
	}

	// Distinct Panel Page Endpoints (Deep-linking)
	panelRoutes := []string{
		"GET /dashboard",
		"GET /inbounds",
		"GET /clients",
		"GET /certificates",
		"GET /config",
		"GET /logs",
		"GET /backup",
		"GET /login",
		"GET /settings",
		"GET /panel",
		"GET /panel/",
		"GET /panel/dashboard",
		"GET /panel/inbounds",
		"GET /panel/clients",
		"GET /panel/certificates",
		"GET /panel/config",
		"GET /panel/settings",
		"GET /panel/logs",
		"GET /panel/backup",
		"GET /panel/updates",
	}
	for _, pr := range panelRoutes {
		mux.HandleFunc(pr, serveUI)
	}

	// Catch-all handler: root UI, API 404 guard, and SPA deep-link fallback
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Root homepage
		if r.URL.Path == "/" {
			serveUI(w, r)
			return
		}

		// API Guard: Unknown API route must ALWAYS return 404 JSON, NEVER HTML!
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/panel/api/") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"success": false,
				"message": fmt.Sprintf("API endpoint not found: %s %s", r.Method, r.URL.Path),
			})
			return
		}

		// Static assets fallback and favicon
		if strings.HasPrefix(r.URL.Path, "/assets/") || r.URL.Path == "/favicon.svg" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// All other routes fall back to SPA UI shell
		serveUI(w, r)
	})

	// Wrap with enterprise security headers, panic recovery, and request telemetry
	productionHandler := api.PanicRecovery(api.SecurityHeaders(api.RequestLogger(mux)))

	// Bind TCP Listener with intelligent collision & OS permission guard (handles Windows excluded port ranges)
	listener, err := net.Listen("tcp", ":"+webPort)
	if err != nil {
		logger.Warningf("NEXUS: Configured web port %s is unavailable (%v). Scanning for free fallback port...", webPort, err)
		fallbackPorts := []string{"8000", "2054", "54321", "2083", "8088", "8888"}
		for _, fb := range fallbackPorts {
			l, fbErr := net.Listen("tcp", ":"+fb)
			if fbErr == nil {
				listener = l
				logger.Infof("NEXUS: Web panel successfully bound to available port %s (port %s was blocked by OS permissions/conflict)", fb, webPort)
				log.Printf("[Info] Notice: Port %s was blocked by OS permissions. Fell back to http://0.0.0.0:%s", webPort, fb)
				webPort = fb
				_ = db.SetSetting("web_port", fb)
				break
			}
		}
		if listener == nil {
			logger.Errorf("NEXUS: Failed to bind web panel to any TCP port: %v", err)
			_ = pm.Stop()
			log.Fatalf("HTTP server error: %v", err)
		}
	}

	srv := &http.Server{
		Handler: productionHandler,
	}

	go func() {
		logger.Infof("NEXUS: web panel listening on http://0.0.0.0:%s", webPort)
		log.Printf("[Info] Nexus Web Panel listening on http://0.0.0.0:%s", webPort)
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			logger.Errorf("NEXUS: HTTP server error: %v", err)
			_ = pm.Stop()
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Info] Shutting down Nexus Panel gracefully...")
	_ = srv.Close()
	_ = pm.Stop()
}
