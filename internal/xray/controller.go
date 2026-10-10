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

var clientTrafficRegex = regexp.MustCompile(`user>>>([^>]+)>>>traffic>>>(downlink|uplink)`)

// UserTraffic represents accrued upload and download bytes for a user
type UserTraffic struct {
	Email    string `json:"email"`
	Uplink   int64  `json:"uplink"`
	Downlink int64  `json:"downlink"`
}

// Controller manages the Xray-core instance via its internal gRPC API
type Controller struct {
	mu            sync.Mutex
	conn          *grpc.ClientConn
	handlerClient command.HandlerServiceClient
	statsClient   statsService.StatsServiceClient
	lastStats     map[string]int64
	isConnected   bool
}

// NewController creates and connects a new gRPC controller to the Xray core
func NewController(apiAddress string) (*Controller, error) {
	conn, err := grpc.NewClient(apiAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to xray gRPC api at %s: %w", apiAddress, err)
	}

	return &Controller{
		conn:          conn,
		handlerClient: command.NewHandlerServiceClient(conn),
		statsClient:   statsService.NewStatsServiceClient(conn),
		lastStats:     make(map[string]int64),
		isConnected:   true,
	}, nil
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

	if !c.isConnected {
		return fmt.Errorf("controller is not connected")
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
		return fmt.Errorf("failed to add vless user %q to inbound %q: %w", email, inboundTag, err)
	}

	return nil
}

// AddTrojanUser dynamically registers a Trojan client on a running inbound without restarting Xray
func (c *Controller) AddTrojanUser(inboundTag, email, password string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isConnected {
		return fmt.Errorf("controller is not connected")
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
		return fmt.Errorf("failed to add trojan user %q to inbound %q: %w", email, inboundTag, err)
	}

	return nil
}

// RemoveUser dynamically removes a client (by email) from an inbound without restarting Xray
func (c *Controller) RemoveUser(inboundTag, email string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isConnected {
		return fmt.Errorf("controller is not connected")
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
		return fmt.Errorf("failed to remove user %q from inbound %q: %w", email, inboundTag, err)
	}

	return nil
}

// QueryTraffic queries and returns incremental traffic usage for each user since last check
func (c *Controller) QueryTraffic() (map[string]*UserTraffic, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isConnected {
		return nil, fmt.Errorf("controller is not connected")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := c.statsClient.QueryStats(ctx, &statsService.QueryStatsRequest{Reset_: false})
	if err != nil {
		return nil, fmt.Errorf("failed to query stats: %w", err)
	}

	result := make(map[string]*UserTraffic)
	isInitialPass := len(c.lastStats) == 0

	for _, stat := range resp.GetStat() {
		lastVal, exists := c.lastStats[stat.Name]
		c.lastStats[stat.Name] = stat.Value

		if isInitialPass {
			continue
		}

		if !exists || stat.Value < lastVal {
			lastVal = 0
		}

		delta := stat.Value - lastVal
		if delta <= 0 {
			continue
		}

		matches := clientTrafficRegex.FindStringSubmatch(stat.Name)
		if len(matches) != 3 {
			continue
		}

		email := matches[1]
		direction := matches[2] // "downlink" or "uplink"

		traffic, ok := result[email]
		if !ok {
			traffic = &UserTraffic{Email: email}
			result[email] = traffic
		}

		if direction == "uplink" {
			traffic.Uplink += delta
		} else if direction == "downlink" {
			traffic.Downlink += delta
		}
	}

	return result, nil
}
