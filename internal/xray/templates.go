package xray

import (
	"encoding/json"
	"fmt"
)

// VlessClient represents a VLESS client user
type VlessClient struct {
	ID    string `json:"id"`
	Flow  string `json:"flow,omitempty"` // e.g. "xtls-rprx-vision"
	Email string `json:"email"`
}

// TrojanClient represents a Trojan client user
type TrojanClient struct {
	Password string `json:"password"`
	Email    string `json:"email"`
}

// TLSCertificate represents TLS certificate file paths
type TLSCertificate struct {
	CertificateFile string `json:"certificateFile"`
	KeyFile         string `json:"keyFile"`
}

// DefaultSniffingConfig returns standard traffic sniffing settings for inbounds
func DefaultSniffingConfig() *SniffingConfig {
	return &SniffingConfig{
		Enabled:      true,
		DestOverride: []string{"http", "tls", "quic"},
	}
}

// BuildVlessRealityInbound creates an inbound configuration for VLESS + REALITY over TCP
func BuildVlessRealityInbound(tag string, port int, dest string, serverNames []string, privateKey string, shortIds []string, clients []VlessClient) (*InboundConfig, error) {
	if clients == nil {
		clients = []VlessClient{}
	}

	settingsBytes, err := json.Marshal(map[string]any{
		"clients":    clients,
		"decryption": "none",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal vless settings: %w", err)
	}

	streamSettingsBytes, err := json.Marshal(map[string]any{
		"network":  "tcp",
		"security": "reality",
		"realitySettings": map[string]any{
			"show":        false,
			"dest":        dest,
			"xver":        0,
			"serverNames": serverNames,
			"privateKey":  privateKey,
			"shortIds":    shortIds,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal reality streamSettings: %w", err)
	}

	return &InboundConfig{
		Tag:            tag,
		Listen:         "0.0.0.0",
		Port:           port,
		Protocol:       "vless",
		Settings:       settingsBytes,
		StreamSettings: streamSettingsBytes,
		Sniffing:       DefaultSniffingConfig(),
	}, nil
}

// BuildVlessWebSocketInbound creates an inbound configuration for VLESS + WebSocket
func BuildVlessWebSocketInbound(tag string, port int, path string, tlsCert *TLSCertificate, clients []VlessClient) (*InboundConfig, error) {
	if clients == nil {
		clients = []VlessClient{}
	}

	settingsBytes, err := json.Marshal(map[string]any{
		"clients":    clients,
		"decryption": "none",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal vless settings: %w", err)
	}

	streamMap := map[string]any{
		"network": "ws",
		"wsSettings": map[string]any{
			"path": path,
		},
	}

	if tlsCert != nil && tlsCert.CertificateFile != "" && tlsCert.KeyFile != "" {
		streamMap["security"] = "tls"
		streamMap["tlsSettings"] = map[string]any{
			"certificates": []TLSCertificate{*tlsCert},
		}
	} else {
		streamMap["security"] = "none"
	}

	streamSettingsBytes, err := json.Marshal(streamMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws streamSettings: %w", err)
	}

	return &InboundConfig{
		Tag:            tag,
		Listen:         "0.0.0.0",
		Port:           port,
		Protocol:       "vless",
		Settings:       settingsBytes,
		StreamSettings: streamSettingsBytes,
		Sniffing:       DefaultSniffingConfig(),
	}, nil
}

// BuildVlessHttpUpgradeInbound creates an inbound configuration for VLESS + HTTPUpgrade
func BuildVlessHttpUpgradeInbound(tag string, port int, path string, tlsCert *TLSCertificate, clients []VlessClient) (*InboundConfig, error) {
	if clients == nil {
		clients = []VlessClient{}
	}

	settingsBytes, err := json.Marshal(map[string]any{
		"clients":    clients,
		"decryption": "none",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal vless settings: %w", err)
	}

	streamMap := map[string]any{
		"network": "httpupgrade",
		"httpupgradeSettings": map[string]any{
			"path": path,
		},
	}

	if tlsCert != nil && tlsCert.CertificateFile != "" && tlsCert.KeyFile != "" {
		streamMap["security"] = "tls"
		streamMap["tlsSettings"] = map[string]any{
			"certificates": []TLSCertificate{*tlsCert},
		}
	} else {
		streamMap["security"] = "none"
	}

	streamSettingsBytes, err := json.Marshal(streamMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal httpupgrade streamSettings: %w", err)
	}

	return &InboundConfig{
		Tag:            tag,
		Listen:         "0.0.0.0",
		Port:           port,
		Protocol:       "vless",
		Settings:       settingsBytes,
		StreamSettings: streamSettingsBytes,
		Sniffing:       DefaultSniffingConfig(),
	}, nil
}

// BuildTrojanInbound creates an inbound configuration for Trojan (TCP + TLS)
func BuildTrojanInbound(tag string, port int, tlsCert TLSCertificate, clients []TrojanClient) (*InboundConfig, error) {
	if clients == nil {
		clients = []TrojanClient{}
	}

	settingsBytes, err := json.Marshal(map[string]any{
		"clients": clients,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal trojan settings: %w", err)
	}

	streamSettingsBytes, err := json.Marshal(map[string]any{
		"network":  "tcp",
		"security": "tls",
		"tlsSettings": map[string]any{
			"certificates": []TLSCertificate{tlsCert},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal trojan tls streamSettings: %w", err)
	}

	return &InboundConfig{
		Tag:            tag,
		Listen:         "0.0.0.0",
		Port:           port,
		Protocol:       "trojan",
		Settings:       settingsBytes,
		StreamSettings: streamSettingsBytes,
		Sniffing:       DefaultSniffingConfig(),
	}, nil
}
