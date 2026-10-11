package xray

import (
	"context"
	"fmt"
	"regexp"
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
}

// NewController creates a new gRPC controller for Xray core and attempts initial connection
func NewController(apiAddress string) (*Controller, error) {
	c := &Controller{
		apiAddress:   apiAddress,
		lastStats:    make(map[string]int64),
		lastSeenMap:  make(map[string]int64),
		onlineEmails: make([]string, 0),
	}

	_ = c.ensureConnected()
	return c, nil
}

func (c *Controller) ensureConnected() error {
	if c.isConnected && c.conn != nil {
		return nil
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

// GetTraffic queries and returns incremental traffic usage for inbounds and clients since the last check
func (c *Controller) GetTraffic() ([]*InboundTraffic, []*ClientTraffic, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return nil, nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := c.statsClient.QueryStats(ctx, &statsService.QueryStatsRequest{Reset_: false})
	if err != nil {
		c.isConnected = false
		return nil, nil, fmt.Errorf("failed to query stats: %w", err)
	}

	tagMap := make(map[string]*InboundTraffic)
	clientMap := make(map[string]*ClientTraffic)
	baselinePass := len(c.lastStats) == 0

	for _, stat := range resp.GetStat() {
		lastVal, exists := c.lastStats[stat.Name]
		c.lastStats[stat.Name] = stat.Value

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
			email := matches[1]
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

	return inboundList, clientList, nil
}

// GetOnlineUsers queries Xray StatsService.GetUsersStats to return every user with an active connection
func (c *Controller) GetOnlineUsers() ([]string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnected(); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := c.statsClient.GetUsersStats(ctx, &statsService.GetUsersStatsRequest{})
	if err != nil {
		c.isConnected = false
		return nil, fmt.Errorf("failed to get users stats: %w", err)
	}

	var users []string
	for _, u := range resp.GetUsers() {
		if u != nil && u.GetEmail() != "" {
			users = append(users, u.GetEmail())
		}
	}

	return users, nil
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
		}
	}

	activeList := make([]string, 0, len(c.lastSeenMap))
	for email, seen := range c.lastSeenMap {
		if now-seen < gracePeriodSec {
			activeList = append(activeList, email)
		} else {
			delete(c.lastSeenMap, email)
		}
	}
	c.onlineEmails = activeList
}

// IsClientOnline returns whether the given email has been active or connected within grace period
func (c *Controller) IsClientOnline(email string) bool {
	c.onlineMu.RLock()
	defer c.onlineMu.RUnlock()

	if c.lastSeenMap == nil {
		return false
	}
	seen, ok := c.lastSeenMap[email]
	if !ok {
		return false
	}
	return time.Now().Unix()-seen < 45
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
	_, clientTraffics, err := c.GetTraffic()
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
