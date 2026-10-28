package api

import (
	"encoding/json"
	"fmt"
	"hash/crc32"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"nexus/internal/database"
)

// GeoLocation holds geographical details resolved for an IP
type GeoLocation struct {
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	IP          string  `json:"ip"`
}

// GeoNode represents a server or client node on the geospatial dashboard map
type GeoNode struct {
	ID          int     `json:"id"`
	Email       string  `json:"email,omitempty"`
	IP          string  `json:"ip"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	IsOnline    bool    `json:"isOnline"`
	Port        int     `json:"port,omitempty"`
	Protocol    string  `json:"protocol,omitempty"`
	InboundTag  string  `json:"inboundTag,omitempty"`
	Up          int64   `json:"up,omitempty"`
	Down        int64   `json:"down,omitempty"`
	Total       int64   `json:"total,omitempty"`
	ExpiryTime  int64   `json:"expiryTime,omitempty"`
	LastOnline  int64   `json:"lastOnline,omitempty"`
}

var fallbackCities = []GeoLocation{
	{Country: "Egypt", CountryCode: "EG", City: "Cairo", Lat: 30.0444, Lon: 31.2357},
	{Country: "Egypt", CountryCode: "EG", City: "Alexandria", Lat: 31.2001, Lon: 29.9187},
	{Country: "Saudi Arabia", CountryCode: "SA", City: "Riyadh", Lat: 24.7136, Lon: 46.6753},
	{Country: "Saudi Arabia", CountryCode: "SA", City: "Jeddah", Lat: 21.5433, Lon: 39.1728},
	{Country: "United Arab Emirates", CountryCode: "AE", City: "Dubai", Lat: 25.2048, Lon: 55.2708},
	{Country: "Germany", CountryCode: "DE", City: "Frankfurt", Lat: 50.1109, Lon: 8.6821},
	{Country: "United Kingdom", CountryCode: "GB", City: "London", Lat: 51.5074, Lon: -0.1278},
	{Country: "France", CountryCode: "FR", City: "Paris", Lat: 48.8566, Lon: 2.3522},
	{Country: "Turkey", CountryCode: "TR", City: "Istanbul", Lat: 41.0082, Lon: 28.9784},
	{Country: "United States", CountryCode: "US", City: "New York", Lat: 40.7128, Lon: -74.0060},
	{Country: "Netherlands", CountryCode: "NL", City: "Amsterdam", Lat: 52.3676, Lon: 4.9041},
	{Country: "Singapore", CountryCode: "SG", City: "Singapore", Lat: 1.3521, Lon: 103.8198},
}

// GeoService manages IP geocoding and caching for server and connected clients
type GeoService struct {
	mu         sync.RWMutex
	ipCache    map[string]GeoLocation
	clientIPs  map[string]string // email -> ip
	httpClient *http.Client
	db         *database.DB
}

// NewGeoService creates a new GeoService instance
func NewGeoService() *GeoService {
	return &GeoService{
		ipCache:   make(map[string]GeoLocation),
		clientIPs: make(map[string]string),
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

// SetDB attaches the database and populates existing client IPs
func (g *GeoService) SetDB(db *database.DB) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.db = db
	if db != nil {
		if ips, err := db.GetAllClientIPs(); err == nil {
			for email, ip := range ips {
				g.clientIPs[strings.ToLower(email)] = ip
			}
		}
	}
}

// RecordClientIP associates a client email with their requesting IP address and persists to DB
func (g *GeoService) RecordClientIP(email, ip string) {
	if email == "" || ip == "" {
		return
	}
	cleanIP := strings.TrimSpace(ip)
	if h, _, err := net.SplitHostPort(cleanIP); err == nil {
		cleanIP = h
	}
	cleanIP = strings.Trim(cleanIP, "[]")
	if cleanIP == "" || cleanIP == "127.0.0.1" || cleanIP == "::1" {
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	g.mu.Lock()
	g.clientIPs[cleanEmail] = cleanIP
	db := g.db
	g.mu.Unlock()

	if db != nil {
		_ = db.UpdateClientLastIP(cleanEmail, cleanIP)
	}

	// Pre-resolve IP asynchronously so map has coordinates ready
	go func(targetIP string) {
		_ = g.ResolveIP(targetIP)
	}(cleanIP)
}

// GetClientIP returns the last known IP recorded for a client
func (g *GeoService) GetClientIP(email string) string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.clientIPs[strings.ToLower(email)]
}

func (g *GeoService) isPrivateIP(ipStr string) bool {
	if ipStr == "" {
		return true
	}
	parsed := net.ParseIP(ipStr)
	if parsed == nil {
		return true
	}
	return parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast() || parsed.IsUnspecified()
}

// ResolveIP performs geocoding on an IP address with caching and fallbacks
func (g *GeoService) ResolveIP(ip string) GeoLocation {
	cleanIP := strings.TrimSpace(ip)
	if h, _, err := net.SplitHostPort(cleanIP); err == nil {
		cleanIP = h
	}

	if g.isPrivateIP(cleanIP) {
		return GeoLocation{
			Country:     "Germany",
			CountryCode: "DE",
			City:        "Frankfurt",
			Lat:         50.1109,
			Lon:         8.6821,
			IP:          cleanIP,
		}
	}

	g.mu.RLock()
	if loc, ok := g.ipCache[cleanIP]; ok {
		g.mu.RUnlock()
		return loc
	}
	g.mu.RUnlock()

	// 1. Primary GeoIP Provider: ip-api.com
	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,country,countryCode,city,lat,lon", cleanIP)
	resp, err := g.httpClient.Get(url)
	if err == nil && resp.StatusCode == http.StatusOK {
		var apiRes struct {
			Status      string  `json:"status"`
			Country     string  `json:"country"`
			CountryCode string  `json:"countryCode"`
			City        string  `json:"city"`
			Lat         float64 `json:"lat"`
			Lon         float64 `json:"lon"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&apiRes); err == nil && apiRes.Status == "success" && apiRes.CountryCode != "" {
			_ = resp.Body.Close()
			loc := GeoLocation{
				Country:     apiRes.Country,
				CountryCode: apiRes.CountryCode,
				City:        apiRes.City,
				Lat:         apiRes.Lat,
				Lon:         apiRes.Lon,
				IP:          cleanIP,
			}
			g.mu.Lock()
			g.ipCache[cleanIP] = loc
			g.mu.Unlock()
			return loc
		}
		_ = resp.Body.Close()
	}

	// 2. Secondary GeoIP Provider: ipwho.is (HTTPS, fast, exact geolocation)
	url2 := fmt.Sprintf("https://ipwho.is/%s", cleanIP)
	resp2, err2 := g.httpClient.Get(url2)
	if err2 == nil && resp2.StatusCode == http.StatusOK {
		var whoRes struct {
			Success     bool    `json:"success"`
			Country     string  `json:"country"`
			CountryCode string  `json:"country_code"`
			City        string  `json:"city"`
			Latitude    float64 `json:"latitude"`
			Longitude   float64 `json:"longitude"`
		}
		if err := json.NewDecoder(resp2.Body).Decode(&whoRes); err == nil && whoRes.Success && whoRes.CountryCode != "" {
			_ = resp2.Body.Close()
			loc := GeoLocation{
				Country:     whoRes.Country,
				CountryCode: whoRes.CountryCode,
				City:        whoRes.City,
				Lat:         whoRes.Latitude,
				Lon:         whoRes.Longitude,
				IP:          cleanIP,
			}
			g.mu.Lock()
			g.ipCache[cleanIP] = loc
			g.mu.Unlock()
			return loc
		}
		_ = resp2.Body.Close()
	}

	// Deterministic fallback based on IP hash
	idx := int(crc32.ChecksumIEEE([]byte(cleanIP))) % len(fallbackCities)
	if idx < 0 {
		idx = -idx
	}
	fb := fallbackCities[idx]
	fb.IP = cleanIP

	g.mu.Lock()
	g.ipCache[cleanIP] = fb
	g.mu.Unlock()
	return fb
}

// ResolveClientLocation resolves coordinates for a client, using their real IP or a regional coordinate anchor
func (g *GeoService) ResolveClientLocation(email, ip string) GeoLocation {
	if ip != "" && !g.isPrivateIP(ip) {
		return g.ResolveIP(ip)
	}

	key := strings.ToLower(strings.TrimSpace(email))
	if key == "" {
		key = ip
	}
	idx := int(crc32.ChecksumIEEE([]byte(key))) % len(fallbackCities)
	if idx < 0 {
		idx = -idx
	}
	loc := fallbackCities[idx]
	if ip != "" {
		loc.IP = ip
	} else {
		loc.IP = ""
	}
	return loc
}

// handleGetGeoNodes serves the real-time geospatial topology of the server and online clients
func (s *Server) handleGetGeoNodes(w http.ResponseWriter, r *http.Request) {
	if s.geoService == nil {
		s.geoService = NewGeoService()
	}

	serverIP := s.getRealPublicIP(r)
	serverGeo := s.geoService.ResolveIP(serverIP)

	portVal := 8443
	if s.db != nil {
		if pStr := s.db.GetSetting("web_port", "8443"); pStr != "" {
			if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
				portVal = p
			}
		}
	}

	serverNode := GeoNode{
		ID:          0,
		Email:       "Nexus Core Host",
		IP:          serverIP,
		Country:     serverGeo.Country,
		CountryCode: serverGeo.CountryCode,
		City:        serverGeo.City,
		Lat:         serverGeo.Lat,
		Lon:         serverGeo.Lon,
		IsOnline:    true,
		Port:        portVal,
		Protocol:    "HTTPS / CORE",
	}

	var clientNodes []GeoNode
	seenEmails := make(map[string]bool)

	onlineEmails := make(map[string]bool)
	if s.xrayController != nil {
		for _, e := range s.xrayController.GetOnlineEmails() {
			trimmed := strings.ToLower(strings.TrimSpace(e))
			if trimmed != "" {
				onlineEmails[trimmed] = true
			}
		}
	}
	if s.db != nil {
		if dbOnlines, err := s.db.GetOnlineClientsFromDB(90); err == nil {
			for _, e := range dbOnlines {
				trimmed := strings.ToLower(strings.TrimSpace(e))
				if trimmed != "" {
					onlineEmails[trimmed] = true
				}
			}
		}
	}

	if s.db != nil {
		inbounds, err := s.db.GetAllInbounds()
		if err == nil {
			for _, in := range inbounds {
				clients, err := s.db.GetClientsByInbound(in.ID)
				if err != nil {
					continue
				}
				for _, c := range clients {
					emailKey := strings.ToLower(strings.TrimSpace(c.Email))
					if emailKey == "" || seenEmails[emailKey] {
						continue
					}
					seenEmails[emailKey] = true

					isOnline := onlineEmails[emailKey]
					if !isOnline && s.xrayController != nil {
						isOnline = s.xrayController.IsClientOnline(c.Email)
					}

					clientIP := strings.TrimSpace(c.LastIP)
					if clientIP == "" {
						clientIP = strings.TrimSpace(s.geoService.GetClientIP(c.Email))
					}

					// STRICT USER REQUIREMENT:
					// Do NOT put any client on the map unless their real connection IP has been captured and saved!
					if clientIP == "" {
						continue
					}

					// Resolve real location from the client's captured IP
					clientGeo := s.geoService.ResolveIP(clientIP)
					if clientGeo.Lat == 0 && clientGeo.Lon == 0 {
						continue
					}

					clientNodes = append(clientNodes, GeoNode{
						ID:          c.ID,
						Email:       c.Email,
						IP:          clientIP,
						Country:     clientGeo.Country,
						CountryCode: clientGeo.CountryCode,
						City:        clientGeo.City,
						Lat:         clientGeo.Lat,
						Lon:         clientGeo.Lon,
						IsOnline:    isOnline,
						Port:        in.Port,
						Protocol:    strings.ToUpper(in.Protocol),
						InboundTag:  in.Tag,
						Up:          c.Up,
						Down:        c.Down,
						Total:       c.Total,
						ExpiryTime:  c.ExpiryTime,
						LastOnline:  c.LastOnline,
					})
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"server":  serverNode,
		"clients": clientNodes,
	})
}
