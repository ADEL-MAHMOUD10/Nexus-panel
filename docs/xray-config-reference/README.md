# Xray-core Configuration Reference (Project X)

> **Source**: [Configuration File | Project X Official Documentation](https://xtls.github.io/en/config/)  
> **Source Repository**: `XTLS/Xray-docs-next` (`docs/en/config/`)  
> **LLM Complete Knowledge Base**: [llms-full.txt](./llms-full.txt) (734 KB exhaustive uncompressed reference)

---

## 📑 Master Index & File Directory

### 1. Root Configuration Architecture
- [`index.md`](./index.md): Configuration overview, root JSON schema, and structural conventions.
- [`log.md`](./log.md): Logging subsystem (`loglevel`, `access`, `error`, `dnsLog`).
- [`api.md`](./api.md): gRPC API service (`tag`, `services`: `HandlerService`, `StatsService`, `LoggerService`, `RoutingService`, `ObservatoryService`).
- [`policy.md`](./policy.md): Local policy configurations (`levels`: `statsUserUplink`, `statsUserDownlink`, `statsUserOnline`, `handshake`, `connIdle`, `bufferSize`; `system`: `statsInboundUplink`, `statsInboundDownlink`, `statsOutboundUplink`, `statsOutboundDownlink`).
- [`stats.md`](./stats.md): Internal statistics engine activation (`"stats": {}`).
- [`routing.md`](./routing.md): Advanced traffic routing, domain resolution strategies (`AsIs`, `IPIfNonMatch`, `IPOnDemand`), rule matching (`domain`, `ip`, `port`, `inboundTag`, `protocol`, `attrs`), rule attributes, and balancers.
- [`dns.md`](./dns.md): Internal DNS resolver, upstream servers, hosts static mapping, client IP override, query strategy (`UseIP`, `UseIPv4`, `UseIPv6`).
- [`fakedns.md`](./fakedns.md): FakeDNS address pool allocation, IP range mapping (`ipPool`, `poolSize`).
- [`transport.md`](./transport.md): Global transport configuration object.
- [`metrics.md`](./metrics.md): Prometheus metrics exporter configuration (`tag`, `listen`, `address`).
- [`observatory.md`](./observatory.md): Outbound health checking, latency measurement, subject selector, probe interval.
- [`reverse.md`](./reverse.md): Reverse proxy tunneling (`bridges`, `portals`).
- [`geodata.md`](./geodata.md): GeoIP (`geoip.dat`) and GeoSite (`geosite.dat`) loading mechanisms and memory optimization.
- [`env.md`](./env.md): Xray runtime environment variables (`XRAY_LOCATION_ASSET`, `XRAY_BROWSER_DIALER`, etc.).

---

### 2. Inbound Protocols & Handlers ([`inbounds/`](./inbounds/))
- [`inbound.md`](./inbound.md): General Inbound configuration structure (`listen`, `port`, `protocol`, `settings`, `streamSettings`, `tag`, `sniffing`, `allocate`).
- [`inbounds/vless.md`](./inbounds/vless.md): **VLESS Protocol** — lightweight, zero-overhead authentication protocol. Clients list (`id`, `flow`, `email`, `level`), `decryption: "none"`, and `fallbacks`.
- [`inbounds/trojan.md`](./inbounds/trojan.md): **Trojan Protocol** — HTTPS mimicry protocol. Clients list (`password`, `email`, `level`), `fallbacks`.
- [`inbounds/vmess.md`](./inbounds/vmess.md): **VMess Protocol** — signature encryption protocol. Clients list (`id`, `alterId`, `email`, `level`), `detours`, and `default`.
- [`inbounds/shadowsocks.md`](./inbounds/shadowsocks.md): **Shadowsocks Protocol** — Shadowsocks 2022 (`2022-blake3-aes-128-gcm`, `2022-blake3-aes-256-gcm`, `2022-blake3-chacha20-poly1305`) and AEAD legacy ciphers.
- [`inbounds/wireguard.md`](./inbounds/wireguard.md): **WireGuard Inbound** — Kernel/Go WireGuard tunnel inbound (`secretKey`, `peers`, `mtu`).
- [`inbounds/hysteria.md`](./inbounds/hysteria.md): **Hysteria Inbound** — UDP-based high-throughput protocol.
- [`inbounds/masque.md`](./inbounds/masque.md): **MASQUE Inbound** — Multiplexed Application Substrate over QUIC Encryption.
- [`inbounds/socks.md`](./inbounds/socks.md): **SOCKS Inbound** — Standard SOCKS4/SOCKS4a/SOCKS5 server.
- [`inbounds/http.md`](./inbounds/http.md): **HTTP Inbound** — Standard HTTP/HTTPS proxy server.
- [`inbounds/tunnel.md`](./inbounds/tunnel.md) / [`inbounds/dokodemo.md`](./inbounds/dokodemo.md): **Dokodemo-door (Tunnel)** — Arbitrary port forwarding and transparent proxy inbound.
- [`inbounds/tun.md`](./inbounds/tun.md): **TUN Device Inbound** — Virtual network interface capture for full-system proxying.

---

### 3. Outbound Protocols & Handlers ([`outbounds/`](./outbounds/))
- [`outbound.md`](./outbound.md): General Outbound configuration structure (`protocol`, `settings`, `streamSettings`, `tag`, `sendThrough`, `mux`).
- [`outbounds/freedom.md`](./outbounds/freedom.md): **Freedom Outbound** — Direct internet breakout (`domainStrategy`, `redirect`, `userLevel`).
- [`outbounds/blackhole.md`](./outbounds/blackhole.md): **Blackhole Outbound** — Traffic sinkhole / blocker (`response: { "type": "none" | "http" }`).
- [`outbounds/vless.md`](./outbounds/vless.md): **VLESS Outbound** — Forwarding to remote VLESS server (`vnext`, `users`).
- [`outbounds/trojan.md`](./outbounds/trojan.md): **Trojan Outbound** — Forwarding to remote Trojan server (`servers`, `password`).
- [`outbounds/vmess.md`](./outbounds/vmess.md): **VMess Outbound** — Forwarding to remote VMess server (`vnext`, `users`).
- [`outbounds/shadowsocks.md`](./outbounds/shadowsocks.md): **Shadowsocks Outbound** — Forwarding to remote Shadowsocks server.
- [`outbounds/wireguard.md`](./outbounds/wireguard.md): **WireGuard Outbound** — Kernel/Go WireGuard client outbound (`secretKey`, `endpoint`, `peers`).
- [`outbounds/dns.md`](./outbounds/dns.md): **DNS Outbound** — Intercepts DNS queries and hands them to Xray internal DNS.
- [`outbounds/loopback.md`](./outbounds/loopback.md): **Loopback Outbound** — Routes traffic back into Xray routing table for multi-stage inspection.
- [`outbounds/http.md`](./outbounds/http.md): **HTTP Outbound** — Connect through upstream HTTP proxy.
- [`outbounds/socks.md`](./outbounds/socks.md): **SOCKS Outbound** — Connect through upstream SOCKS proxy.
- [`outbounds/hysteria.md`](./outbounds/hysteria.md): **Hysteria Outbound**.
- [`outbounds/masque.md`](./outbounds/masque.md): **MASQUE Outbound**.

---

### 4. Transport Layers & Stream Settings ([`transports/`](./transports/))
- [`transports/index.md`](./transports/index.md): StreamSettings overview (`network`, `security`, `tlsSettings`, `realitySettings`, etc.).
- [`transports/raw.md`](./transports/raw.md) / [`transports/tcp.md`](./transports/tcp.md): **RAW / TCP Transport** — Standard raw stream transport and header obfuscation (`header: { "type": "none" | "http" }`).
- [`transports/tls.md`](./transports/tls.md): **TLS Security** — Complete TLS configuration (`serverName`, `certificates`, `alpn`, `minVersion`, `maxVersion`, `cipherSuites`, `allowInsecure`).
- [`transports/reality.md`](./transports/reality.md): **REALITY Security** — Elimination of TLS server certificate fingerprints. Server configuration (`show`, `dest`, `xver`, `serverNames`, `privateKey`, `shortIds`, `minClientVer`, `maxTimeDiff`) and Client configuration (`publicKey`, `fingerprint`, `serverName`, `shortId`, `spiderX`).
- [`transports/websocket.md`](./transports/websocket.md): **WebSocket Transport** — Path and HTTP headers multiplexing (`path`, `headers`, `maxEarlyData`, `earlyDataHeaderName`).
- [`transports/grpc.md`](./transports/grpc.md): **gRPC Transport** — HTTP/2 gRPC encapsulation (`serviceName`, `multiMode`, `idle_timeout`, `health_check_timeout`).
- [`transports/httpupgrade.md`](./transports/httpupgrade.md): **HTTPUpgrade Transport** — Modern lightweight HTTP/1.1 Upgrade tunneling with lower overhead than WebSocket (`host`, `path`).
- [`transports/splithttp.md`](./transports/splithttp.md) / [`transports/xhttp.md`](./transports/xhttp.md): **SplitHTTP / XHTTP Transport** — Independent uplink/downlink chunked streaming over CDN / HTTP/2 / HTTP/3.
- [`transports/mkcp.md`](./transports/mkcp.md): **mKCP Transport** — KCP UDP stream transport (`mtu`, `tti`, `uplinkCapacity`, `downlinkCapacity`, `congestion`, `readBufferSize`, `writeBufferSize`, `seed`, `header`).
- [`transports/quic.md`](./transports/quic.md): **QUIC Transport** — IETF QUIC stream transport.
- [`transports/sockopt.md`](./transports/sockopt.md): **Socket Options (`sockopt`)** — Low-level OS socket flags (`mark`, `tcpFastOpen`, `tproxy`, `domainStrategy`, `dialerProxy`, `acceptProxyProtocol`, `tcpKeepAliveInterval`, `tcpMptcp`).
- [`transports/finalmask.md`](./transports/finalmask.md): Advanced traffic shaping and masking.

---

### 5. Architectural Features & Mechanisms ([`features/`](./features/))
- [`features/fallback.md`](./features/fallback.md): **Xray Fallback Mechanism** — Detailed multi-fallback routing based on SNI, ALPN (`h2`, `http/1.1`), and Path. Realizes zero-fingerprint web server coexistence on Port 443 with Nginx/Caddy/Apache.
- [`features/multiple.md`](./features/multiple.md): **Multi-Inbound & Multi-Outbound Strategies** — Designing scalable multi-node and multi-protocol server topologies.
- [`features/browser_dialer.md`](./features/browser_dialer.md): Browser dialer integration.
- [`features/xtls.md`](./features/xtls.md): XTLS & Vision protocol background and specs.

---

## 💡 Quick Rules of Thumb for Nexus Panel Development

1. **Client Identification & Stats Tracking**:
   - Each client object under an inbound **MUST** have `"level": 0` (or another defined policy level) explicitly defined in the JSON.
   - The Policy configuration must define `"policy": { "levels": { "0": { "statsUserUplink": true, "statsUserDownlink": true, "statsUserOnline": true } } }`.
   - The root configuration must include an empty object `"stats": {}`.
   - The root configuration must include `"api": { "tag": "api", "services": ["StatsService", "HandlerService"] }`.

2. **Traffic Query Formats via gRPC**:
   - Inbound traffic: `inbound>>>[tag]>>>traffic>>>(uplink|downlink)`
   - User traffic: `user>>>[email]>>>traffic>>>(uplink|downlink)`
   - User online presence: `user>>>[email]>>>online`

3. **REALITY Configuration Sanitization**:
   - Server-side `streamSettings.realitySettings` requires: `dest`, `serverNames`, `privateKey`, `shortIds`.
   - Client-side requires: `publicKey`, `fingerprint` (e.g. `chrome`), `serverName`, `shortId`, `spiderX`.
   - Server must **NEVER** receive `publicKey` or `fingerprint` in its inbound `streamSettings`.

4. **XTLS-Vision Rule**:
   - `xtls-rprx-vision` flow is **ONLY** valid when the transport is direct TCP (with TLS or REALITY). It is incompatible with WebSocket, gRPC, or HTTPUpgrade.
