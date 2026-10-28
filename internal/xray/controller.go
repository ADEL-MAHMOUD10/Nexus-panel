package xray

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/xtls/xray-core/app/proxyman/command"
	statsService "github.com/xtls/xray-core/app/stats/command"
	"github.com/xtls/xray-core/common/protocol"
	"github.com/xtls/xray-core/common/serial"
	"github.com/xtls/xray-core/proxy/trojan"
	"github.com/xtls/xray-core/proxy/vless"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var (
	trafficRegex       = regexp.MustCompile(`(inbound|outbound)>>>([^>]+)>>>traffic>>>(downlink|uplink)`)
	clientTrafficRegex = regexp.MustCompile(`user>>>([^>]+)>>>traffic>>>(downlink|uplink)`)
	clientOnlineRegex  = regexp.MustCompile(`user>>>([^>]+)>>>online`)
)

// InboundTraffic represents accrued upload and download bytes for an inbound
type InboundTraffic struct {
	Tag  string `json:"tag"`
	Up   int64  `json:"up"`
	Down int64  `json:"down"`
}

// ClientTraffic represents accrued upload and download bytes for a user/client
type ClientTraffic struct {
	Email string `json:"email"`
	Up    int64  `json:"up"`
	Down  int64  `json:"down"`
}

// UserTraffic represents accrued upload and download bytes for a user (legacy compatibility)
type UserTraffic struct {
	Email    string `json:"email"`
	Uplink   int64  `json:"uplink"`
	Downlink int64  `json:"downlink"`
}

// ClientSpeed holds real-time transfer rate for a user
type ClientSpeed struct {
	UpSpeed   float64 `json:"upSpeed"`   // Bytes/sec
	DownSpeed float64 `json:"downSpeed"` // Bytes/sec
	LastSeen  int64   `json:"lastSeen"`
}

// Controller manages the Xray-core instance via its internal gRPC API
type Controller struct {
	mu            sync.Mutex
	apiAddress    string
	conn          *grpc.ClientConn
	handlerClient command.HandlerServiceClient
	statsClient   statsService.StatsServiceClient
	lastStats     map[string]int64
	isConnected   bool

	onlineMu     sync.RWMutex
	lastSeenMap  map[string]int64
	onlineEmails []string

	speedMu       sync.RWMutex
	clientSpeeds  map[string]*ClientSpeed
	inboundSpeeds map[string]*ClientSpeed
}

// NewController creates a new gRPC controller for Xray core and attempts initial connection
func NewController(apiAddress string) (*Controller, error) {
	c := &Controller{
		apiAddress:    apiAddress,
		lastStats:     make(map[string]int64),
		lastSeenMap:   make(map[string]int64),
		onlineEmails:  make([]string, 0),
		clientSpeeds:  make(map[string]*ClientSpeed),
		inboundSpeeds: make(map[string]*ClientSpeed),
	}

	_ = c.ensureConnected()
	return c, nil
}

func (c *Controller) ensureConnected() error {
	if c.isConnected && c.conn != nil {
		return nil
	}

	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}

	conn, err := grpc.NewClient(c.apiAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		c.isConnected = false
		return fmt.Errorf("failed to connect to xray gRPC api at %s: %w", c.apiAddress, err)
	}

	c.conn = conn
	c.handlerClient = command.NewHandlerServiceClient(conn)
	c.statsClient = statsService.NewStatsServiceClient(conn)
	c.isConnected = true
	return nil
}

// Close closes the underlying gRPC connection
func (c *Controller) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.isConnected = false
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// AddVlessUser dynamically registers a VLESS client on a running inbound without restarting Xray
func (c *Controller) AddVlessUser(inboundTag, email, userID, flow string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return err
	}

	account := &vless.Account{
		Id:   userID,
		Flow: flow,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.handlerClient.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag: inboundTag,
		Operation: serial.ToTypedMessage(&command.AddUserOperation{
			User: &protocol.User{
				Email:   email,
				Account: serial.ToTypedMessage(account),
			},
		}),
	})
	if err != nil {
		c.isConnected = false
		return fmt.Errorf("failed to add vless user %q to inbound %q: %w", email, inboundTag, err)
	}

	return nil
}

// AddTrojanUser dynamically registers a Trojan client on a running inbound without restarting Xray
func (c *Controller) AddTrojanUser(inboundTag, email, password string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return err
	}

	account := &trojan.Account{
		Password: password,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.handlerClient.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag: inboundTag,
		Operation: serial.ToTypedMessage(&command.AddUserOperation{
			User: &protocol.User{
				Email:   email,
				Account: serial.ToTypedMessage(account),
			},
		}),
	})
	if err != nil {
		c.isConnected = false
		return fmt.Errorf("failed to add trojan user %q to inbound %q: %w", email, inboundTag, err)
	}

	return nil
}

// RemoveUser dynamically removes a client (by email) from an inbound without restarting Xray
func (c *Controller) RemoveUser(inboundTag, email string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := c.handlerClient.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag: inboundTag,
		Operation: serial.ToTypedMessage(&command.RemoveUserOperation{
			Email: email,
		}),
	})
	if err != nil {
		c.isConnected = false
		return fmt.Errorf("failed to remove user %q from inbound %q: %w", email, inboundTag, err)
	}

	return nil
}

// GetTraffic queries and returns incremental traffic usage for inbounds and clients, plus any online user emails
func (c *Controller) GetTraffic() ([]*InboundTraffic, []*ClientTraffic, []string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return nil, nil, nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := c.statsClient.QueryStats(ctx, &statsService.QueryStatsRequest{Reset_: false})
	if err != nil {
		c.isConnected = false
		return nil, nil, nil, fmt.Errorf("failed to query stats: %w", err)
	}

	tagMap := make(map[string]*InboundTraffic)
	clientMap := make(map[string]*ClientTraffic)
	var onlineEmails []string
	onlineSet := make(map[string]bool)
	baselinePass := len(c.lastStats) == 0

	for _, stat := range resp.GetStat() {
		lastVal, exists := c.lastStats[stat.Name]
		c.lastStats[stat.Name] = stat.Value

		// Check for Xray statsUserOnline counter (user>>>email>>>online)
		if matches := clientOnlineRegex.FindStringSubmatch(stat.Name); len(matches) == 2 {
			email := strings.TrimSpace(matches[1])
			if email != "" && stat.Value > 0 && !onlineSet[email] {
				onlineSet[email] = true
				onlineEmails = append(onlineEmails, email)
			}
		}

		if baselinePass {
			continue
		}

		if !exists || stat.Value < lastVal {
			lastVal = 0
		}

		delta := stat.Value - lastVal
		if delta <= 0 {
			continue
		}

		if matches := trafficRegex.FindStringSubmatch(stat.Name); len(matches) == 4 {
			kind := matches[1]
			tag := matches[2]
			dir := matches[3]

			if kind == "inbound" && tag != "api" {
				tr, ok := tagMap[tag]
				if !ok {
					tr = &InboundTraffic{Tag: tag}
					tagMap[tag] = tr
				}
				if dir == "uplink" {
					tr.Up += delta
				} else {
					tr.Down += delta
				}
			}
		} else if matches := clientTrafficRegex.FindStringSubmatch(stat.Name); len(matches) == 3 {
			email := strings.TrimSpace(matches[1])
			dir := matches[2]

			ct, ok := clientMap[email]
			if !ok {
				ct = &ClientTraffic{Email: email}
				clientMap[email] = ct
			}
			if dir == "uplink" {
				ct.Up += delta
			} else {
				ct.Down += delta
			}
			if !onlineSet[email] {
				onlineSet[email] = true
				onlineEmails = append(onlineEmails, email)
			}
		}
	}

	inboundList := make([]*InboundTraffic, 0, len(tagMap))
	for _, tr := range tagMap {
		inboundList = append(inboundList, tr)
	}

	clientList := make([]*ClientTraffic, 0, len(clientMap))
	for _, ct := range clientMap {
		clientList = append(clientList, ct)
	}

	return inboundList, clientList, onlineEmails, nil
}

// GetOnlineUsers queries Xray StatsService.GetUsersStats to return every user with an active connection
func (c *Controller) GetOnlineUsers() ([]string, error) {
	users, _, err := c.GetOnlineUsersWithIPs()
	return users, err
}

// GetOnlineUsersWithIPs queries Xray StatsService.GetUsersStats to return active users and their connected source IPs
func (c *Controller) GetOnlineUsersWithIPs() ([]string, map[string]string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return nil, nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := c.statsClient.GetUsersStats(ctx, &statsService.GetUsersStatsRequest{})
	if err != nil {
		// Do not tear down overall connection if GetUsersStats is unimplemented on this core
		return nil, nil, fmt.Errorf("users stats not supported or failed: %w", err)
	}

	var users []string
	userIPs := make(map[string]string)

	for _, u := range resp.GetUsers() {
		if u == nil || u.GetEmail() == "" {
			continue
		}

		email := strings.TrimSpace(u.GetEmail())
		users = append(users, email)

		for _, entry := range u.GetIps() {
			if entry == nil {
				continue
			}
			rawIP := strings.TrimSpace(entry.GetIp())
			if rawIP != "" {
				cleanIP := rawIP
				if h, _, err := net.SplitHostPort(rawIP); err == nil {
					cleanIP = h
				}
				cleanIP = strings.Trim(cleanIP, "[]")
				if cleanIP != "" && cleanIP != "127.0.0.1" && cleanIP != "::1" {
					userIPs[email] = cleanIP
					userIPs[strings.ToLower(email)] = cleanIP
				}
			}
		}
	}

	return users, userIPs, nil
}

// RefreshOnline updates the internal live online tracking table and prunes clients seen past gracePeriodSec
func (c *Controller) RefreshOnline(activeEmails []string, now int64, gracePeriodSec int64) {
	c.onlineMu.Lock()
	defer c.onlineMu.Unlock()

	if c.lastSeenMap == nil {
		c.lastSeenMap = make(map[string]int64)
	}

	for _, email := range activeEmails {
		if email != "" {
			c.lastSeenMap[email] = now
			c.lastSeenMap[strings.ToLower(email)] = now
		}
	}

	activeList := make([]string, 0, len(c.lastSeenMap))
	for email, seen := range c.lastSeenMap {
		if now-seen <= gracePeriodSec {
			activeList = append(activeList, email)
		} else {
			delete(c.lastSeenMap, email)
		}
	}
	c.onlineEmails = activeList
}

// IsClientOnline returns whether the given email has been active, connected, or had transfer rate
func (c *Controller) IsClientOnline(email string) bool {
	cleanEmail := strings.TrimSpace(email)
	if cleanEmail == "" {
		return false
	}
	lowerEmail := strings.ToLower(cleanEmail)

	// 1. If client currently has positive speed, they are actively online right now
	c.speedMu.RLock()
	if c.clientSpeeds != nil {
		if spd, ok := c.clientSpeeds[cleanEmail]; ok && spd != nil {
			if time.Now().Unix()-spd.LastSeen <= 15 && (spd.UpSpeed > 0 || spd.DownSpeed > 0) {
				c.speedMu.RUnlock()
				return true
			}
		}
		if spd, ok := c.clientSpeeds[lowerEmail]; ok && spd != nil {
			if time.Now().Unix()-spd.LastSeen <= 15 && (spd.UpSpeed > 0 || spd.DownSpeed > 0) {
				c.speedMu.RUnlock()
				return true
			}
		}
	}
	c.speedMu.RUnlock()

	// 2. Check if client was seen within grace period
	c.onlineMu.RLock()
	defer c.onlineMu.RUnlock()

	if c.lastSeenMap == nil {
		return false
	}
	now := time.Now().Unix()
	if seen, ok := c.lastSeenMap[cleanEmail]; ok {
		if now-seen <= 90 {
			return true
		}
	}
	if seen, ok := c.lastSeenMap[lowerEmail]; ok {
		if now-seen <= 90 {
			return true
		}
	}
	return false
}

// GetOnlineEmails returns a snapshot of all currently active client emails
func (c *Controller) GetOnlineEmails() []string {
	c.onlineMu.RLock()
	defer c.onlineMu.RUnlock()

	res := make([]string, len(c.onlineEmails))
	copy(res, c.onlineEmails)
	return res
}

// QueryTraffic provides backward compatibility for user traffic querying
func (c *Controller) QueryTraffic() (map[string]*UserTraffic, error) {
	_, clientTraffics, _, err := c.GetTraffic()
	if err != nil {
		return nil, err
	}

	result := make(map[string]*UserTraffic)
	for _, ct := range clientTraffics {
		result[ct.Email] = &UserTraffic{
			Email:    ct.Email,
			Uplink:   ct.Up,
			Downlink: ct.Down,
		}
	}
	return result, nil
}

// UpdateClientSpeed registers a delta transfer for an email over dt seconds
func (c *Controller) UpdateClientSpeed(email string, deltaUp, deltaDown int64, dt float64) {
	c.speedMu.Lock()
	defer c.speedMu.Unlock()
	if c.clientSpeeds == nil {
		c.clientSpeeds = make(map[string]*ClientSpeed)
	}
	if dt <= 0 {
		dt = 1.0
	}
	upSpd := float64(deltaUp) / dt
	downSpd := float64(deltaDown) / dt
	entry := &ClientSpeed{
		UpSpeed:   upSpd,
		DownSpeed: downSpd,
		LastSeen:  time.Now().Unix(),
	}
	c.clientSpeeds[email] = entry
	c.clientSpeeds[strings.ToLower(email)] = entry
}

// GetClientSpeed returns the latest up and down transfer rates (bytes/sec) for an email
func (c *Controller) GetClientSpeed(email string) (float64, float64) {
	c.speedMu.RLock()
	defer c.speedMu.RUnlock()
	if c.clientSpeeds == nil {
		return 0, 0
	}
	spd, ok := c.clientSpeeds[email]
	if !ok {
		spd, ok = c.clientSpeeds[strings.ToLower(email)]
	}
	if ok && spd != nil {
		// If last active was > 10s ago, speed drops to 0
		if time.Now().Unix()-spd.LastSeen > 10 {
			return 0, 0
		}
		return spd.UpSpeed, spd.DownSpeed
	}
	return 0, 0
}

// DecayClientSpeeds decays speeds gracefully for clients not present in active list
func (c *Controller) DecayClientSpeeds(activeThisTick []string) {
	c.speedMu.Lock()
	defer c.speedMu.Unlock()
	if c.clientSpeeds == nil {
		return
	}
	activeMap := make(map[string]bool)
	for _, e := range activeThisTick {
		activeMap[e] = true
	}
	now := time.Now().Unix()
	for email, spd := range c.clientSpeeds {
		if !activeMap[email] {
			// If not seen for over 5s, decay down smoothly rather than immediate zeroing
			if now-spd.LastSeen > 5 {
				spd.UpSpeed *= 0.4
				spd.DownSpeed *= 0.4
				if spd.UpSpeed < 20 {
					spd.UpSpeed = 0
				}
				if spd.DownSpeed < 20 {
					spd.DownSpeed = 0
				}
			}
			// If not seen for over 60s, prune
			if now-spd.LastSeen > 60 {
				delete(c.clientSpeeds, email)
			}
		}
	}
}

// UpdateInboundSpeed registers a delta transfer for an inbound tag over dt seconds
func (c *Controller) UpdateInboundSpeed(tag string, deltaUp, deltaDown int64, dt float64) {
	c.speedMu.Lock()
	defer c.speedMu.Unlock()
	if c.inboundSpeeds == nil {
		c.inboundSpeeds = make(map[string]*ClientSpeed)
	}
	if dt <= 0 {
		dt = 1.0
	}
	upSpd := float64(deltaUp) / dt
	downSpd := float64(deltaDown) / dt
	entry := &ClientSpeed{
		UpSpeed:   upSpd,
		DownSpeed: downSpd,
		LastSeen:  time.Now().Unix(),
	}
	c.inboundSpeeds[tag] = entry
}

// GetInboundSpeed returns the latest up and down transfer rates (bytes/sec) for an inbound tag
func (c *Controller) GetInboundSpeed(tag string) (float64, float64) {
	c.speedMu.RLock()
	defer c.speedMu.RUnlock()
	if c.inboundSpeeds == nil {
		return 0, 0
	}
	spd, ok := c.inboundSpeeds[tag]
	if ok && spd != nil {
		if time.Now().Unix()-spd.LastSeen > 10 {
			return 0, 0
		}
		return spd.UpSpeed, spd.DownSpeed
	}
	return 0, 0
}

// DecayInboundSpeeds decays speeds gracefully for inbounds not present in active list
func (c *Controller) DecayInboundSpeeds(activeThisTick []string) {
	c.speedMu.Lock()
	defer c.speedMu.Unlock()
	if c.inboundSpeeds == nil {
		return
	}
	activeMap := make(map[string]bool)
	for _, t := range activeThisTick {
		activeMap[t] = true
	}
	now := time.Now().Unix()
	for tag, spd := range c.inboundSpeeds {
		if !activeMap[tag] {
			if now-spd.LastSeen > 5 {
				spd.UpSpeed *= 0.4
				spd.DownSpeed *= 0.4
				if spd.UpSpeed < 20 {
					spd.UpSpeed = 0
				}
				if spd.DownSpeed < 20 {
					spd.DownSpeed = 0
				}
			}
			if now-spd.LastSeen > 60 {
				delete(c.inboundSpeeds, tag)
			}
		}
	}
}
