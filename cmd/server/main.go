package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
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

	// Write baseline Xray config if not exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
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
	var ctrl *xray.Controller
	grpcAddr := fmt.Sprintf("127.0.0.1:%d", apiPort)
	if pm.IsRunning() {
		// give core a brief moment to bind gRPC
		time.Sleep(500 * time.Millisecond)
		ctrl, err = xray.NewController(grpcAddr)
		if err != nil {
			logger.Warningf("NEXUS: failed to connect to Xray gRPC: %v", err)
		} else {
			logger.Infof("NEXUS: connected to Xray gRPC API at %s", grpcAddr)
			defer ctrl.Close()
		}
	}

	// Background Traffic & Quota Monitoring Worker
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			if ctrl == nil {
				continue
			}

			traffics, err := ctrl.QueryTraffic()
			if err != nil {
				continue
			}

			for email, traffic := range traffics {
				_ = db.AddTraffic(email, traffic.Uplink, traffic.Downlink)
			}

			// Check client quotas and expirations
			inbounds, _ := db.GetAllInbounds()
			for _, in := range inbounds {
				clients, _ := db.GetClientsByInbound(in.ID)
				for _, c := range clients {
					if c.Enable && db.CheckClientExpiredOrDepleted(&c) {
						log.Printf("[Quota] Client %s exceeded quota or expired. Disconnecting...", c.Email)
						_ = ctrl.RemoveUser(in.Tag, c.Email)
						c.Enable = false
						_ = db.SaveClient(&c)
					}
				}
			}
		}
	}()

	// Start HTTP REST API Server
	webPort := db.GetSetting("web_port", "8443")
	apiServer := api.NewServer(db, ctrl, pm)
	mux := http.NewServeMux()
	apiServer.RegisterRoutes(mux)

	// Serve Embedded Assets
	fileServer := web.FileServerHandler()
	mux.Handle("/assets/", fileServer)

	// Panel SPA UI Page Renderer
	serveUI := func(w http.ResponseWriter, r *http.Request) {
		htmlBytes, err := web.GetIndexHTML()
		if err != nil {
			http.Error(w, "Failed to load dashboard UI", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(htmlBytes)
	}

	// Distinct Panel Page Endpoints
	panelRoutes := []string{
		"GET /panel",
		"GET /panel/",
		"GET /panel/inbounds",
		"GET /panel/clients",
		"GET /panel/logs",
		"GET /panel/config",
		"GET /panel/settings",
		"GET /panel/updates",
		"GET /inbounds",
		"GET /clients",
		"GET /logs",
		"GET /config",
		"GET /settings",
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

		// Any subroute under /panel/ falls back to UI shell
		if strings.HasPrefix(r.URL.Path, "/panel/") {
			serveUI(w, r)
			return
		}

		// Static assets fallback
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.NotFound(w, r)
	})

	srv := &http.Server{
		Addr:    ":" + webPort,
		Handler: mux,
	}

	go func() {
		logger.Infof("NEXUS: web panel listening on http://0.0.0.0:%s", webPort)
		log.Printf("[Info] Nexus Web Panel listening on http://0.0.0.0:%s", webPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("NEXUS: HTTP server error: %v", err)
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Info] Shutting down Nexus Panel gracefully...")
	_ = srv.Close()
}
