package xray

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"nexus/internal/database"
	"nexus/internal/logger"
)

// GenerateFullConfig builds the complete, production-grade Xray configuration from database inbounds
func GenerateFullConfig(db *database.DB, apiPort int) (*Config, error) {
	baseCfg := DefaultBaseConfig(apiPort)

	inbounds, err := db.GetAllInbounds()
	if err != nil {
		return baseCfg, fmt.Errorf("failed to fetch database inbounds: %w", err)
	}

	webPortStr := db.GetSetting("web_port", "8443")
	webPort, _ := strconv.Atoi(webPortStr)
	if webPort <= 0 {
		webPort = 8443
	}

	for _, in := range inbounds {
		if !in.Enable {
			continue
		}

		if in.Port == webPort {
			logger.Warningf("NEXUS: skipping inbound %s (port %d) because it collides with panel web_port %d", in.Tag, in.Port, webPort)
			continue
		}

		inCfg, err := buildInboundConfig(db, &in)
		if err != nil {
			logger.Errorf("NEXUS: error building inbound %s (port %d): %v", in.Tag, in.Port, err)
			continue
		}

		baseCfg.Inbounds = append(baseCfg.Inbounds, *inCfg)
	}

	return baseCfg, nil
}

func buildInboundConfig(db *database.DB, in *database.Inbound) (*InboundConfig, error) {
	listen := in.Listen
	if listen == "" {
		listen = "0.0.0.0"
	}

	clients, _ := db.GetClientsByInbound(in.ID)

	var settingsBytes []byte
	proto := strings.ToLower(strings.TrimSpace(in.Protocol))

	switch proto {
	case "vless":
		type vlessClient struct {
			ID    string `json:"id"`
			Flow  string `json:"flow,omitempty"`
			Email string `json:"email"`
			Level int    `json:"level"`
		}
		var vlessClients []vlessClient
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			flow := c.Flow
			// Flow "xtls-rprx-vision" only applies to direct TCP (REALITY or TLS)
			vlessClients = append(vlessClients, vlessClient{
				ID:    c.UUID,
				Flow:  flow,
				Email: c.Email,
				Level: 0,
			})
		}
		settMap := map[string]any{
			"clients":    vlessClients,
			"decryption": "none",
		}
		if in.Settings != "" {
			var rawSett map[string]any
			if json.Unmarshal([]byte(in.Settings), &rawSett) == nil {
				if fb, ok := rawSett["fallbacks"]; ok {
					settMap["fallbacks"] = fb
				}
			}
		}
		settingsBytes, _ = json.Marshal(settMap)

	case "trojan":
		type trojanClient struct {
			Password string `json:"password"`
			Email    string `json:"email"`
			Level    int    `json:"level"`
		}
		var trojanClients []trojanClient
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			trojanClients = append(trojanClients, trojanClient{
				Password: c.Password,
				Email:    c.Email,
				Level:    0,
			})
		}
		settMap := map[string]any{
			"clients": trojanClients,
		}
		if in.Settings != "" {
			var rawSett map[string]any
			if json.Unmarshal([]byte(in.Settings), &rawSett) == nil {
				if fb, ok := rawSett["fallbacks"]; ok {
					settMap["fallbacks"] = fb
				}
			}
		}
		settingsBytes, _ = json.Marshal(settMap)

	case "vmess":
		type vmessClient struct {
			ID      string `json:"id"`
			AlterId int    `json:"alterId"`
			Email   string `json:"email"`
			Level   int    `json:"level"`
		}
		var vmessClients []vmessClient
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			vmessClients = append(vmessClients, vmessClient{
				ID:      c.UUID,
				AlterId: 0,
				Email:   c.Email,
				Level:   0,
			})
		}
		settingsBytes, _ = json.Marshal(map[string]any{
			"clients": vmessClients,
		})

	case "shadowsocks":
		settMap := map[string]any{
			"method":  "2022-blake3-aes-128-gcm",
			"network": "tcp,udp",
		}
		if in.Settings != "" {
			_ = json.Unmarshal([]byte(in.Settings), &settMap)
		}
		// If password is not explicitly in settings but clients exist, use first client password
		if p, ok := settMap["password"].(string); (!ok || p == "") && len(clients) > 0 {
			for _, c := range clients {
				if c.Enable && c.Password != "" {
					settMap["password"] = c.Password
					break
				}
			}
		}
		if _, ok := settMap["network"]; !ok {
			settMap["network"] = "tcp,udp"
		}
		settingsBytes, _ = json.Marshal(settMap)

	case "wireguard":
		var wgSettings map[string]any
		if in.Settings != "" {
			_ = json.Unmarshal([]byte(in.Settings), &wgSettings)
		}
		if wgSettings == nil {
			wgSettings = make(map[string]any)
		}
		if _, ok := wgSettings["mtu"]; !ok {
			wgSettings["mtu"] = 1420
		}
		type wgPeer struct {
			PublicKey    string   `json:"publicKey"`
			PreSharedKey string   `json:"preSharedKey,omitempty"`
			AllowedIPs   []string `json:"allowedIPs"`
			Email        string   `json:"email"`
			Level        int      `json:"level"`
		}
		var peers []wgPeer
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			pubKey := c.Password
			if pubKey == "" {
				pubKey = c.UUID
			}
			peers = append(peers, wgPeer{
				PublicKey:  pubKey,
				AllowedIPs: []string{"0.0.0.0/0", "::/0"},
				Email:      c.Email,
				Level:      0,
			})
		}
		if len(peers) > 0 {
			wgSettings["peers"] = peers
		}
		settingsBytes, _ = json.Marshal(wgSettings)

	case "hysteria", "hysteria2":
		type hyUser struct {
			Auth  string `json:"auth"`
			Level int    `json:"level"`
			Email string `json:"email"`
		}
		var hyUsers []hyUser
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			authKey := c.Password
			if authKey == "" {
				authKey = c.UUID
			}
			hyUsers = append(hyUsers, hyUser{
				Auth:  authKey,
				Level: 0,
				Email: c.Email,
			})
		}
		settMap := map[string]any{
			"version": 2,
			"users":   hyUsers,
		}
		settingsBytes, _ = json.Marshal(settMap)

	case "dokodemo-door":
		dokoSettings := map[string]any{
			"address":        "127.0.0.1",
			"network":        "tcp,udp",
			"followRedirect": false,
		}
		if in.Settings != "" {
			_ = json.Unmarshal([]byte(in.Settings), &dokoSettings)
		}
		settingsBytes, _ = json.Marshal(dokoSettings)

	case "socks":
		settMap := map[string]any{
			"auth": "noauth",
			"udp":  true,
		}
		if in.Settings != "" {
			_ = json.Unmarshal([]byte(in.Settings), &settMap)
		}
		settingsBytes, _ = json.Marshal(settMap)

	case "http":
		settMap := map[string]any{
			"allowTransparent": false,
		}
		if in.Settings != "" {
			_ = json.Unmarshal([]byte(in.Settings), &settMap)
		}
		settingsBytes, _ = json.Marshal(settMap)

	default:
		if in.Settings != "" {
			settingsBytes = []byte(in.Settings)
		} else {
			settingsBytes = []byte(`{}`)
		}
	}

	// Clean & sanitize streamSettings
	var streamSettingsBytes []byte
	if in.StreamSettings != "" {
		var streamMap map[string]any
		if err := json.Unmarshal([]byte(in.StreamSettings), &streamMap); err == nil {
			// Normalize transport network & method
			netName, _ := streamMap["network"].(string)
			if netName == "" {
				netName, _ = streamMap["method"].(string)
			}
			if netName == "mkcp" {
				streamMap["network"] = "kcp"
			} else if netName == "splithttp" {
				streamMap["network"] = "xhttp"
			}

			// Clean REALITY metadata
			if sec, ok := streamMap["security"].(string); ok && sec == "reality" {
				if reality, ok := streamMap["realitySettings"].(map[string]any); ok {
					delete(reality, "settings")
					streamMap["realitySettings"] = reality
				}
			} else if sec, ok := streamMap["security"].(string); ok && sec == "tls" {
				if tls, ok := streamMap["tlsSettings"].(map[string]any); ok {
					delete(tls, "settings")
					if sn, ok := tls["serverName"].(string); ok && strings.TrimSpace(sn) == "" {
						delete(tls, "serverName")
					}
					streamMap["tlsSettings"] = tls
				}
			}

			streamSettingsBytes, _ = json.Marshal(streamMap)
		} else {
			streamSettingsBytes = []byte(in.StreamSettings)
		}
	}

	// Sniffing
	sniffing := DefaultSniffingConfig()
	if in.Sniffing != "" {
		var customSniff SniffingConfig
		if json.Unmarshal([]byte(in.Sniffing), &customSniff) == nil {
			sniffing = &customSniff
		}
	}

	tag := in.Tag
	if tag == "" {
		tag = fmt.Sprintf("in-%d", in.Port)
	}

	return &InboundConfig{
		Tag:            tag,
		Listen:         listen,
		Port:           in.Port,
		Protocol:       proto,
		Settings:       json.RawMessage(settingsBytes),
		StreamSettings: json.RawMessage(streamSettingsBytes),
		Sniffing:       sniffing,
	}, nil
}

// SaveAndApplyConfig regenerates the full config, writes it to disk, and restarts the Xray core
func SaveAndApplyConfig(db *database.DB, apiPort int, configPath string, pm *ProcessManager) error {
	cfg, err := GenerateFullConfig(db, apiPort)
	if err != nil {
		return fmt.Errorf("failed to generate full Xray configuration: %w", err)
	}

	cfgData, err := cfg.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to serialize Xray configuration: %w", err)
	}

	if err := os.WriteFile(configPath, cfgData, 0644); err != nil {
		return fmt.Errorf("failed to write config to %s: %w", configPath, err)
	}

	logger.Infof("NEXUS: successfully rebuilt and synced %s with %d inbounds", configPath, len(cfg.Inbounds)-1)

	if pm != nil && pm.IsRunning() {
		logger.Infof("NEXUS: reloading Xray-core to apply updated listeners and ports...")
		if err := pm.Restart(); err != nil {
			logger.Errorf("NEXUS: error restarting Xray after config update: %v", err)
			return err
		}
		logger.Infof("NEXUS: Xray-core reloaded successfully")
	}

	return nil
}
