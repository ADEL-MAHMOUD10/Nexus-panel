package xray

import (
	"crypto/ecdh"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"nexus/internal/crypto"
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
			"level":   0,
		}
		if in.Settings != "" {
			_ = json.Unmarshal([]byte(in.Settings), &settMap)
		}

		type ssUser struct {
			Password string `json:"password"`
			Email    string `json:"email"`
			Level    int    `json:"level"`
		}
		var ssUsers []ssUser
		for _, c := range clients {
			if !c.Enable {
				continue
			}
			pwd := c.Password
			if pwd == "" {
				pwd = c.UUID
			}
			ssUsers = append(ssUsers, ssUser{
				Password: pwd,
				Email:    c.Email,
				Level:    0,
			})
		}

		if len(ssUsers) > 0 {
			if p, ok := settMap["password"].(string); !ok || p == "" {
				settMap["password"] = ssUsers[0].Password
			}
			settMap["email"] = ssUsers[0].Email
			settMap["level"] = 0
			if len(ssUsers) > 1 {
				settMap["users"] = ssUsers
			}
		}

		if _, ok := settMap["network"]; !ok {
			settMap["network"] = "tcp,udp"
		}
		settMap["level"] = 0
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

		// 1. Strict Validation & Auto-Healing of Server Private Key (secretKey)
		// Must be exactly 32-byte Base64-encoded Curve25519 key
		serverPrivKey, _ := wgSettings["secretKey"].(string)
		serverPrivKey = strings.TrimSpace(serverPrivKey)
		privBytes, privErr := base64.StdEncoding.DecodeString(serverPrivKey)
		needSaveInbound := false

		if privErr != nil || len(privBytes) != 32 {
			wgPair, genErr := crypto.GenerateWireGuardKeyPair()
			if genErr == nil {
				serverPrivKey = wgPair.PrivateKey
				wgSettings["secretKey"] = serverPrivKey
				wgSettings["serverPublicKey"] = wgPair.PublicKey
				needSaveInbound = true
			}
		} else {
			// Ensure serverPublicKey is also recorded in settings if derivable
			if _, hasPub := wgSettings["serverPublicKey"]; !hasPub {
				if privKeyObj, err := ecdh.X25519().NewPrivateKey(privBytes); err == nil {
					wgSettings["serverPublicKey"] = base64.StdEncoding.EncodeToString(privKeyObj.PublicKey().Bytes())
					needSaveInbound = true
				}
			}
		}

		if needSaveInbound && db != nil {
			if updatedSett, err := json.Marshal(wgSettings); err == nil {
				in.Settings = string(updatedSett)
				_ = db.SaveInbound(in)
			}
		}

		// 2. Strict Validation & Auto-Healing of Client Peers
		type wgPeer struct {
			PublicKey    string   `json:"publicKey"`
			PreSharedKey string   `json:"preSharedKey,omitempty"`
			KeepAlive    int      `json:"keepAlive,omitempty"`
			AllowedIPs   []string `json:"allowedIPs"`
			Email        string   `json:"email"`
			Level        int      `json:"level"`
		}

		// If no clients exist in DB, auto-provision an initial client
		if len(clients) == 0 && db != nil {
			clientPair, genErr := crypto.GenerateWireGuardKeyPair()
			if genErr == nil {
				initClient := database.Client{
					InboundID:  in.ID,
					Email:      fmt.Sprintf("peer_%d", in.Port),
					UUID:       clientPair.PrivateKey,
					Password:   clientPair.PublicKey,
					Enable:     true,
					ExpiryTime: 0,
				}
				_ = db.SaveClient(&initClient)
				clients = []database.Client{initClient}
			}
		}

		var peers []wgPeer
		peerIndex := 0
		for _, c := range clients {
			if !c.Enable {
				continue
			}

			// In Xray WireGuard, peer publicKey must be exactly 32-byte Base64
			var clientPubKey string
			cPass := strings.TrimSpace(c.Password)
			cUUID := strings.TrimSpace(c.UUID)

			pBytes, pErr := base64.StdEncoding.DecodeString(cPass)
			uBytes, uErr := base64.StdEncoding.DecodeString(cUUID)

			if pErr == nil && len(pBytes) == 32 {
				clientPubKey = cPass
			} else if uErr == nil && len(uBytes) == 32 {
				clientPubKey = cUUID
				c.Password = clientPubKey
				if db != nil {
					_ = db.SaveClient(&c)
				}
			} else {
				// Client has an invalid key (e.g. legacy shortId hex or UUID) -> auto-heal with genuine Curve25519 keypair
				clientPair, genErr := crypto.GenerateWireGuardKeyPair()
				if genErr == nil {
					clientPubKey = clientPair.PublicKey
					c.Password = clientPair.PublicKey
					c.UUID = clientPair.PrivateKey
					if db != nil {
						_ = db.SaveClient(&c)
					}
				}
			}

			if clientPubKey == "" {
				continue
			}

			// Assign non-overlapping allowedIPs per peer according to official Xray documentation
			var allowedIPs []string
			if len(clients) == 1 {
				allowedIPs = []string{"0.0.0.0/0", "::/0"}
			} else {
				ipOctet := (peerIndex % 250) + 2
				allowedIPs = []string{
					fmt.Sprintf("10.0.0.%d/32", ipOctet),
					fmt.Sprintf("fd00::%x/128", ipOctet),
				}
			}
			peerIndex++

			peers = append(peers, wgPeer{
				PublicKey:  clientPubKey,
				AllowedIPs: allowedIPs,
				Email:      c.Email,
				Level:      0,
			})
		}

		if len(peers) > 0 {
			wgSettings["peers"] = peers
		} else {
			wgSettings["peers"] = []wgPeer{}
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

			// Pre-Flight Protocol Compatibility Validation (Strict Xray-core Rulebook)
			switch proto {
			case "shadowsocks":
				// Shadowsocks is a self-encrypting Layer 4 protocol (SS2022/AEAD) over raw TCP/UDP.
				// In Xray-core, it does NOT support TLS or REALITY stream wrapping.
				streamMap["security"] = "none"
				delete(streamMap, "realitySettings")
				delete(streamMap, "tlsSettings")
				streamMap["network"] = "tcp"

			case "wireguard":
				// WireGuard has its own internal cryptographic tunnel over UDP.
				streamMap["security"] = "none"
				delete(streamMap, "realitySettings")
				delete(streamMap, "tlsSettings")

			case "vmess":
				// VMess does NOT support REALITY or XTLS-Vision.
				if sec, ok := streamMap["security"].(string); ok && sec == "reality" {
					streamMap["security"] = "tls"
					delete(streamMap, "realitySettings")
				}

			case "hysteria", "hysteria2":
				// Hysteria requires built-in QUIC TLS.
				streamMap["security"] = "tls"
				delete(streamMap, "realitySettings")

			case "trojan":
				// If security is none, remove any extraneous TLS or REALITY settings
				if sec, ok := streamMap["security"].(string); ok && sec == "none" {
					delete(streamMap, "realitySettings")
					delete(streamMap, "tlsSettings")
				}

			case "vless":
				// XTLS-Vision flow is strictly invalid on non-TCP or non-TLS/REALITY transports.
				transportNet, _ := streamMap["network"].(string)
				sec, _ := streamMap["security"].(string)
				if transportNet != "tcp" || (sec != "tls" && sec != "reality") {
					// Re-serialize settingsBytes to strip any flow
					var vlessRaw map[string]any
					if json.Unmarshal(settingsBytes, &vlessRaw) == nil {
						if cList, ok := vlessRaw["clients"].([]any); ok {
							for _, item := range cList {
								if cMap, ok := item.(map[string]any); ok {
									delete(cMap, "flow")
								}
							}
							vlessRaw["clients"] = cList
							settingsBytes, _ = json.Marshal(vlessRaw)
						}
					}
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

	var streamJson json.RawMessage
	if proto != "wireguard" && len(streamSettingsBytes) > 0 {
		streamJson = json.RawMessage(streamSettingsBytes)
	}

	return &InboundConfig{
		Tag:            tag,
		Listen:         listen,
		Port:           in.Port,
		Protocol:       proto,
		Settings:       json.RawMessage(settingsBytes),
		StreamSettings: streamJson,
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
