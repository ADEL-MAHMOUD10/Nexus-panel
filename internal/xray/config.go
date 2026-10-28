package xray

import (
	"encoding/json"
	"fmt"
)

// Config represents the top-level configuration structure for Xray-core
type Config struct {
	Log       *LogConfig       `json:"log"`
	API       *APIConfig       `json:"api"`
	Inbounds  []InboundConfig  `json:"inbounds"`
	Outbounds []OutboundConfig `json:"outbounds"`
	Policy    *PolicyConfig    `json:"policy"`
	Routing   *RoutingConfig   `json:"routing"`
	Stats     struct{}         `json:"stats"`
}

type LogConfig struct {
	LogLevel string `json:"loglevel"` // "debug", "info", "warning", "error", "none"
	Access   string `json:"access,omitempty"`
	Error    string `json:"error,omitempty"`
}

type APIConfig struct {
	Tag      string   `json:"tag"`
	Services []string `json:"services"`
}

type InboundConfig struct {
	Tag            string          `json:"tag"`
	Listen         string          `json:"listen"`
	Port           int             `json:"port"`
	Protocol       string          `json:"protocol"` // "vless", "trojan", "dokodemo-door"
	Settings       json.RawMessage `json:"settings"`
	StreamSettings json.RawMessage `json:"streamSettings,omitempty"`
	Sniffing       *SniffingConfig `json:"sniffing,omitempty"`
}

type OutboundConfig struct {
	Tag      string          `json:"tag"`
	Protocol string          `json:"protocol"` // "freedom", "blackhole"
	Settings json.RawMessage `json:"settings,omitempty"`
}

type PolicyConfig struct {
	Levels map[string]PolicyLevel `json:"levels"`
	System PolicySystem           `json:"system"`
}

type PolicyLevel struct {
	StatsUserUplink   bool `json:"statsUserUplink"`
	StatsUserDownlink bool `json:"statsUserDownlink"`
	StatsUserOnline   bool `json:"statsUserOnline"`
}

type PolicySystem struct {
	StatsInboundUplink   bool `json:"statsInboundUplink"`
	StatsInboundDownlink bool `json:"statsInboundDownlink"`
}

type RoutingConfig struct {
	DomainStrategy string        `json:"domainStrategy"`
	Rules          []RoutingRule `json:"rules"`
}

type RoutingRule struct {
	Type        string   `json:"type"`
	InboundTag  []string `json:"inboundTag,omitempty"`
	OutboundTag string   `json:"outboundTag"`
	IP          []string `json:"ip,omitempty"`
	Protocol    []string `json:"protocol,omitempty"`
}

type SniffingConfig struct {
	Enabled      bool     `json:"enabled"`
	DestOverride []string `json:"destOverride"`
}

// DefaultBaseConfig creates a clean baseline Xray config with internal gRPC API enabled
func DefaultBaseConfig(apiPort int) *Config {
	return &Config{
		Log: &LogConfig{
			LogLevel: "warning",
			Access:   "",
		},
		API: &APIConfig{
			Tag: "api",
			Services: []string{
				"HandlerService",
				"StatsService",
				"LoggerService",
			},
		},
		Inbounds: []InboundConfig{
			{
				Tag:      "api",
				Listen:   "127.0.0.1",
				Port:     apiPort,
				Protocol: "dokodemo-door",
				Settings: json.RawMessage(`{"address":"127.0.0.1"}`),
			},
		},
		Outbounds: []OutboundConfig{
			{
				Tag:      "direct",
				Protocol: "freedom",
				Settings: json.RawMessage(`{}`),
			},
			{
				Tag:      "blocked",
				Protocol: "blackhole",
				Settings: json.RawMessage(`{}`),
			},
		},
		Policy: &PolicyConfig{
			Levels: map[string]PolicyLevel{
				"0": {
					StatsUserUplink:   true,
					StatsUserDownlink: true,
					StatsUserOnline:   true,
				},
				"1": {
					StatsUserUplink:   true,
					StatsUserDownlink: true,
					StatsUserOnline:   true,
				},
				"2": {
					StatsUserUplink:   true,
					StatsUserDownlink: true,
					StatsUserOnline:   true,
				},
			},
			System: PolicySystem{
				StatsInboundUplink:   true,
				StatsInboundDownlink: true,
			},
		},
		Routing: &RoutingConfig{
			DomainStrategy: "AsIs",
			Rules: []RoutingRule{
				{
					Type:        "field",
					InboundTag:  []string{"api"},
					OutboundTag: "api",
				},
				{
					Type:        "field",
					Protocol:    []string{"bittorrent"},
					OutboundTag: "blocked",
				},
			},
		},
		Stats: struct{}{},
	}
}

// ToJSON formats the configuration as indented JSON
func (c *Config) ToJSON() ([]byte, error) {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal xray config: %w", err)
	}
	return data, nil
}
