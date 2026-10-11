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
		}
		var trojanClients []trojanClient
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			trojanClients = append(trojanClients, trojanClient{
				Password: c.Password,
				Email:    c.Email,
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
			})
		}
		settingsBytes, _ = json.Marshal(map[string]any{
			"clients": vmessClients,
		})

	case "shadowsocks":
		if in.Settings != "" {
			settingsBytes = []byte(in.Settings)
		} else {
			settingsBytes = []byte(`{"method":"2022-blake3-aes-128-gcm","password":"","network":"tcp,udp"}`)
		}

	default:
		if in.Settings != "" {
			settingsBytes = []byte(in.Settings)
		} else {
			settingsBytes = []byte(`{}`)
		}
	}

	// Clean streamSettings (strip client-only metadata from REALITY before passing to Xray server)
	var streamSettingsBytes []byte
	if in.StreamSettings != "" {
		var streamMap map[string]any
		if err := json.Unmarshal([]byte(in.StreamSettings), &streamMap); err == nil {
			if sec, ok := streamMap["security"].(string); ok && sec == "reality" {
				if reality, ok := streamMap["realitySettings"].(map[string]any); ok {
					// Delete client-only metadata "settings" block so Xray server does not reject config
					delete(reality, "settings")
					streamMap["realitySettings"] = reality
				}
			} else if sec, ok := streamMap["security"].(string); ok && sec == "tls" {
				if tls, ok := streamMap["tlsSettings"].(map[string]any); ok {
					// Delete client-only metadata "settings" block so Xray server does not complain
					delete(tls, "settings")
					// If serverName is empty, omit it so Xray does not fail strict validation
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
