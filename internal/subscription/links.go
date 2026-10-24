package subscription

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"

	"nexus/internal/database"
)

// encodeUserinfo percent-encodes password/auth values for URI authorities
func encodeUserinfo(s string) string {
	return strings.ReplaceAll(url.QueryEscape(s), "+", "%20")
}

// joinHostPort formats host:port safely handling IPv6
func joinHostPort(host string, port int) string {
	host = strings.Trim(host, "[]")
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return net.JoinHostPort(host, strconv.Itoa(port))
}

// BuildInboundLink constructs the official share link matching 3X-UI standards
func BuildInboundLink(inbound *database.Inbound, client *database.Client, serverAddress string) string {
	if inbound == nil || client == nil {
		return ""
	}

	if serverAddress == "" {
		serverAddress = "127.0.0.1"
	}
	if h, _, err := net.SplitHostPort(serverAddress); err == nil {
		serverAddress = h
	}

	var stream map[string]any
	if err := json.Unmarshal([]byte(inbound.StreamSettings), &stream); err != nil {
		stream = make(map[string]any)
	}

	var settings map[string]any
	if err := json.Unmarshal([]byte(inbound.Settings), &settings); err != nil {
		settings = make(map[string]any)
	}

	network, _ := stream["network"].(string)
	if network == "" {
		network = "tcp"
	}

	security, _ := stream["security"].(string)
	if security == "" {
		security = "none"
	}

	params := make(map[string]string)
	params["type"] = network

	// Transmission Network parameters
	switch network {
	case "tcp":
		if tcp, ok := stream["tcpSettings"].(map[string]any); ok {
			if header, ok := tcp["header"].(map[string]any); ok {
				if headerType, ok := header["type"].(string); ok && headerType == "http" {
					params["headerType"] = "http"
					if req, ok := header["request"].(map[string]any); ok {
						if paths, ok := req["path"].([]any); ok && len(paths) > 0 {
							params["path"], _ = paths[0].(string)
						}
						if headers, ok := req["headers"].(map[string]any); ok {
							if hosts, ok := headers["Host"].([]any); ok && len(hosts) > 0 {
								params["host"], _ = hosts[0].(string)
							}
						}
					}
				}
			}
		}
	case "ws":
		if ws, ok := stream["wsSettings"].(map[string]any); ok {
			if p, ok := ws["path"].(string); ok {
				params["path"] = p
			}
			if h, ok := ws["host"].(string); ok && h != "" {
				params["host"] = h
			} else if headers, ok := ws["headers"].(map[string]any); ok {
				if h, ok := headers["Host"].(string); ok {
					params["host"] = h
				}
			}
		}
	case "httpupgrade":
		if hu, ok := stream["httpupgradeSettings"].(map[string]any); ok {
			if p, ok := hu["path"].(string); ok {
				params["path"] = p
			}
			if h, ok := hu["host"].(string); ok {
				params["host"] = h
			}
		}
	case "grpc":
		if grpc, ok := stream["grpcSettings"].(map[string]any); ok {
			if serviceName, ok := grpc["serviceName"].(string); ok {
				params["serviceName"] = serviceName
			}
			if authority, ok := grpc["authority"].(string); ok {
				params["authority"] = authority
			}
		}
	case "kcp", "mkcp":
		params["type"] = "kcp"
		if kcp, ok := stream["kcpSettings"].(map[string]any); ok {
			if header, ok := kcp["header"].(map[string]any); ok {
				if ht, ok := header["type"].(string); ok && ht != "" {
					params["headerType"] = ht
				}
			}
			if seed, ok := kcp["seed"].(string); ok && seed != "" {
				params["seed"] = seed
			}
		}
	case "splithttp", "xhttp":
		params["type"] = "xhttp"
		if xh, ok := stream["xhttpSettings"].(map[string]any); ok {
			if p, ok := xh["path"].(string); ok {
				params["path"] = p
			}
			if h, ok := xh["host"].(string); ok {
				params["host"] = h
			}
			if m, ok := xh["mode"].(string); ok {
				params["mode"] = m
			}
		}
	case "quic":
		params["type"] = "quic"
		if quic, ok := stream["quicSettings"].(map[string]any); ok {
			if sec, ok := quic["security"].(string); ok {
				params["quicSecurity"] = sec
			}
			if key, ok := quic["key"].(string); ok {
				params["key"] = key
			}
			if header, ok := quic["header"].(map[string]any); ok {
				if ht, ok := header["type"].(string); ok {
					params["headerType"] = ht
				}
			}
		}
	}

	// Security parameters (TLS / REALITY)
	switch security {
	case "reality":
		params["security"] = "reality"
		if reality, ok := stream["realitySettings"].(map[string]any); ok {
			if serverNames, ok := reality["serverNames"].([]any); ok && len(serverNames) > 0 {
				params["sni"], _ = serverNames[0].(string)
			}
			if shortIds, ok := reality["shortIds"].([]any); ok && len(shortIds) > 0 {
				params["sid"], _ = shortIds[0].(string)
			}
			if rSettings, ok := reality["settings"].(map[string]any); ok {
				if pbk, ok := rSettings["publicKey"].(string); ok {
					params["pbk"] = pbk
				}
				if fp, ok := rSettings["fingerprint"].(string); ok && fp != "" {
					params["fp"] = fp
				} else {
					params["fp"] = "chrome"
				}
				if spx, ok := rSettings["spiderX"].(string); ok {
					params["spx"] = spx
				} else {
					params["spx"] = "/"
				}
			}
		}
		if network == "tcp" && client.Flow != "" {
			params["flow"] = client.Flow
		}

	case "tls":
		params["security"] = "tls"
		if tls, ok := stream["tlsSettings"].(map[string]any); ok {
			if sni, ok := tls["serverName"].(string); ok && strings.TrimSpace(sni) != "" {
				params["sni"] = strings.TrimSpace(sni)
			} else if serverAddress != "" && net.ParseIP(serverAddress) == nil {
				params["sni"] = serverAddress
			}
			if alpns, ok := tls["alpn"].([]any); ok && len(alpns) > 0 {
				var alpnStrs []string
				for _, a := range alpns {
					if s, ok := a.(string); ok {
						alpnStrs = append(alpnStrs, s)
					}
				}
				if len(alpnStrs) > 0 {
					params["alpn"] = strings.Join(alpnStrs, ",")
				}
			}
			if tSettings, ok := tls["settings"].(map[string]any); ok {
				if fp, ok := tSettings["fingerprint"].(string); ok && fp != "" {
					params["fp"] = fp
				}
			}
		}
		if network == "tcp" && client.Flow != "" {
			params["flow"] = client.Flow
		}

	default:
		params["security"] = "none"
	}

	// Remark for link fragment
	remarkText := inbound.Remark
	if remarkText == "" {
		remarkText = inbound.Tag
	}
	if client.Email != "" {
		remarkText = remarkText + "-" + client.Email
	}

	// Build final protocol link
	proto := strings.ToLower(inbound.Protocol)
	switch proto {
	case "vless":
		params["encryption"] = "none"
		baseURI := fmt.Sprintf("vless://%s@%s", client.UUID, joinHostPort(serverAddress, inbound.Port))
		return buildURLWithQuery(baseURI, params, remarkText)

	case "trojan":
		baseURI := fmt.Sprintf("trojan://%s@%s", encodeUserinfo(client.Password), joinHostPort(serverAddress, inbound.Port))
		return buildURLWithQuery(baseURI, params, remarkText)

	case "vmess":
		// Standard vmess:// base64 JSON config
		vmessConfig := map[string]any{
			"v":    "2",
			"ps":   remarkText,
			"add":  serverAddress,
			"port": inbound.Port,
			"id":   client.UUID,
			"aid":  0,
			"scy":  "auto",
			"net":  network,
			"type": params["headerType"],
			"host": params["host"],
			"path": params["path"],
			"tls":  security,
			"sni":  params["sni"],
			"alpn": params["alpn"],
		}
		if vmessConfig["type"] == "" {
			vmessConfig["type"] = "none"
		}
		b, _ := json.Marshal(vmessConfig)
		return "vmess://" + base64.StdEncoding.EncodeToString(b)

	case "shadowsocks":
		// Standard ss:// SIP002: ss://BASE64(method:password)@server:port#remark
		method, _ := settings["method"].(string)
		if method == "" {
			method = "2022-blake3-aes-128-gcm"
		}
		pwd := client.Password
		if pwd == "" {
			pwd, _ = settings["password"].(string)
		}
		userInfo := base64.URLEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", method, pwd)))
		return fmt.Sprintf("ss://%s@%s#%s", userInfo, joinHostPort(serverAddress, inbound.Port), strings.ReplaceAll(url.QueryEscape(remarkText), "+", "%20"))

	case "wireguard":
		pubKey := client.Password
		if pubKey == "" {
			pubKey = client.UUID
		}
		return fmt.Sprintf("wireguard://%s@%s?publickey=%s#%s", pubKey, joinHostPort(serverAddress, inbound.Port), url.QueryEscape(pubKey), strings.ReplaceAll(url.QueryEscape(remarkText), "+", "%20"))

	case "hysteria", "hysteria2":
		auth := client.Password
		if auth == "" {
			auth = client.UUID
		}
		baseURI := fmt.Sprintf("hy2://%s@%s", encodeUserinfo(auth), joinHostPort(serverAddress, inbound.Port))
		hyParams := make(map[string]string)
		if sni, ok := params["sni"]; ok && sni != "" {
			hyParams["sni"] = sni
		}
		if insecure, ok := params["allowInsecure"]; ok && insecure == "1" {
			hyParams["insecure"] = "1"
		}
		return buildURLWithQuery(baseURI, hyParams, remarkText)

	default:
		return ""
	}
}

func buildURLWithQuery(baseURI string, params map[string]string, remark string) string {
	var sb strings.Builder
	sb.WriteString(baseURI)

	if len(params) > 0 {
		q := url.Values{}
		for k, v := range params {
			if v != "" {
				q.Set(k, v)
			}
		}
		encoded := q.Encode()
		if encoded != "" {
			sb.WriteByte('?')
			sb.WriteString(encoded)
		}
	}

	if remark != "" {
		sb.WriteByte('#')
		sb.WriteString(strings.ReplaceAll(url.QueryEscape(remark), "+", "%20"))
	}

	return sb.String()
}

// ExportBase64Subscription joins multiple config links into a standard Base64 subscription
func ExportBase64Subscription(links []string) string {
	joined := strings.Join(links, "\n")
	return base64.StdEncoding.EncodeToString([]byte(joined))
}

// DeriveSpiderX generates a unique spiderX path for REALITY
func DeriveSpiderX(seed, clientKey string) string {
	if seed == "" && clientKey == "" {
		return "/1234567890"
	}
	sum := sha256.Sum256([]byte(seed + "|" + clientKey))
	return "/" + hex.EncodeToString(sum[:])[:15]
}
