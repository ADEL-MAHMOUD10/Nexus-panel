package api

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strconv"
	"strings"

	psNet "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
	"nexus/internal/database"
)

// FirewallInfo contains server firewall rule evaluation details
type FirewallInfo struct {
	Engine  string `json:"engine"`  // "ufw", "firewalld", "iptables", "unrestricted", "local"
	Status  string `json:"status"`  // e.g. "UFW: Port Allowed", "UFW: Port Blocked", "Unrestricted (Open)"
	IsOpen  bool   `json:"isOpen"`  // true if incoming traffic to this port is allowed
	Details string `json:"details"` // Friendly description
	Command string `json:"command"` // Command to open the port if blocked
}

// PortCheckResult contains comprehensive analysis of port availability, process usage, and firewall rules
type PortCheckResult struct {
	Available  bool         `json:"available"`
	Message    string       `json:"message"`
	TCPInUse   bool         `json:"tcpInUse"`
	UDPInUse   bool         `json:"udpInUse"`
	OccupiedBy string       `json:"occupiedBy,omitempty"`
	Firewall   FirewallInfo `json:"firewall"`
}

// checkPortAvailability performs deep evaluation across:
// 1. Port range (1-65535)
// 2. Reserved ports (Web panel, Xray gRPC controller)
// 3. Database inbounds conflicts
// 4. Live OS sockets (both TCP and UDP)
// 5. Detection of listening service/process name
// 6. Host firewall rules (UFW, firewalld, iptables)
func (s *Server) checkPortAvailability(listenIP string, port int, protocol, streamSettings string, ignoreID int, reqHost string) PortCheckResult {
	fwInfo := checkPortFirewall(port)

	if port <= 0 || port > 65535 {
		return PortCheckResult{
			Available: false,
			Message:   "Invalid port number. Must be between 1 and 65535.",
			Firewall:  fwInfo,
		}
	}

	// 1. Reserved internal Xray API port
	if port == 62789 {
		return PortCheckResult{
			Available: false,
			Message:   "Port 62789 is reserved for internal Xray controller RPC and cannot be used.",
			Firewall:  fwInfo,
		}
	}

	// 2. Check Nexus Web Panel configured port
	webPortStr := s.db.GetSetting("web_port", "8443")
	webPort, _ := strconv.Atoi(webPortStr)
	if webPort <= 0 {
		webPort = 8443
	}
	if port == webPort {
		return PortCheckResult{
			Available:  false,
			Message:    fmt.Sprintf("Port %d is reserved for the Nexus Web Panel. Please choose a different inbound port.", port),
			OccupiedBy: "Nexus Web Panel",
			Firewall:   fwInfo,
		}
	}

	// Check request host port if present
	if reqHost != "" {
		if _, hostPortStr, err := net.SplitHostPort(reqHost); err == nil && hostPortStr != "" {
			if hp, _ := strconv.Atoi(hostPortStr); hp == port {
				return PortCheckResult{
					Available:  false,
					Message:    fmt.Sprintf("Port %d is actively used by the Web Panel web server.", port),
					OccupiedBy: "Nexus Web Panel",
					Firewall:   fwInfo,
				}
			}
		}
	}

	// 3. Check database inbounds conflict
	dummyIn := database.Inbound{
		ID:             ignoreID,
		Listen:         listenIP,
		Port:           port,
		Protocol:       protocol,
		StreamSettings: streamSettings,
	}
	if conflict, err := s.db.CheckInboundPortConflict(&dummyIn, ignoreID); err != nil {
		return PortCheckResult{
			Available: false,
			Message:   "Database error checking port conflict: " + err.Error(),
			Firewall:  fwInfo,
		}
	} else if conflict != nil {
		conflictRemark := conflict.Remark
		if conflictRemark == "" {
			conflictRemark = conflict.Tag
		}
		return PortCheckResult{
			Available:  false,
			Message:    fmt.Sprintf("Port %d is already assigned to Inbound \"%s\" (ID: %d, Protocol: %s).", port, conflictRemark, conflict.ID, strings.ToUpper(conflict.Protocol)),
			OccupiedBy: fmt.Sprintf("Inbound: %s (%s)", conflictRemark, strings.ToUpper(conflict.Protocol)),
			Firewall:   fwInfo,
		}
	}

	// 4. If updating an inbound that is already active on this exact port, skip live socket check if unchanged
	if ignoreID > 0 {
		if currentIn, err := s.db.GetInbound(ignoreID); err == nil && currentIn != nil {
			if currentIn.Port == port && currentIn.Enable {
				return PortCheckResult{
					Available: true,
					Firewall:  fwInfo,
				}
			}
		}
	}

	// 5. Test Live OS Socket Bind on BOTH TCP and UDP
	bindListen := strings.TrimSpace(listenIP)
	if bindListen == "" || bindListen == "0.0.0.0" || bindListen == "::" {
		bindListen = "0.0.0.0"
	}

	// Test TCP
	tcpAddr := fmt.Sprintf("%s:%d", bindListen, port)
	tcpListener, tcpErr := net.Listen("tcp", tcpAddr)
	tcpInUse := (tcpErr != nil)
	if !tcpInUse && tcpListener != nil {
		_ = tcpListener.Close()
	}

	// Test UDP
	var udpInUse bool
	udpAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", bindListen, port))
	if err == nil {
		udpConn, err := net.ListenUDP("udp", udpAddr)
		if err != nil {
			udpInUse = true
		} else {
			_ = udpConn.Close()
		}
	}

	if tcpInUse || udpInUse {
		var inUseProto string
		if tcpInUse && udpInUse {
			inUseProto = "TCP & UDP"
		} else if tcpInUse {
			inUseProto = "TCP"
		} else {
			inUseProto = "UDP"
		}

		procName := findProcessListeningOnPort(port)
		msg := fmt.Sprintf("Port %d (%s) is already in use", port, inUseProto)
		if procName != "" {
			msg += fmt.Sprintf(" by service \"%s\"", procName)
		} else {
			msg += " by another service"
		}
		msg += " on this server."

		return PortCheckResult{
			Available:  false,
			Message:    msg,
			TCPInUse:   tcpInUse,
			UDPInUse:   udpInUse,
			OccupiedBy: procName,
			Firewall:   fwInfo,
		}
	}

	return PortCheckResult{
		Available: true,
		TCPInUse:  false,
		UDPInUse:  false,
		Firewall:  fwInfo,
	}
}

// findProcessListeningOnPort queries OS connections and process table to identify what service is using the port
func findProcessListeningOnPort(port int) string {
	// Method 1: gopsutil connection scan
	conns, err := psNet.Connections("all")
	if err == nil {
		for _, c := range conns {
			if c.Laddr.Port == uint32(port) {
				if c.Pid > 0 {
					if p, err := process.NewProcess(c.Pid); err == nil {
						if name, err := p.Name(); err == nil && name != "" {
							return fmt.Sprintf("%s (PID %d)", name, c.Pid)
						}
					}
					return fmt.Sprintf("PID %d", c.Pid)
				}
			}
		}
	}

	// Method 2: On Linux, use ss -tlpnu fallback
	if runtime.GOOS == "linux" {
		out, err := exec.Command("ss", "-tlpnu", fmt.Sprintf("sport = :%d", port)).CombinedOutput()
		if err == nil && len(out) > 0 {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				if strings.Contains(line, fmt.Sprintf(":%d", port)) {
					if idx := strings.Index(line, "users:(("); idx != -1 {
						part := line[idx+8:]
						if end := strings.Index(part, ")"); end != -1 {
							cleaned := strings.ReplaceAll(part[:end], "\"", "")
							cleaned = strings.ReplaceAll(cleaned, ",fd=", " ")
							return strings.TrimSpace(cleaned)
						}
					}
				}
			}
		}

		// Method 3: fuser fallback
		out, err = exec.Command("fuser", fmt.Sprintf("%d/tcp", port)).CombinedOutput()
		if err == nil {
			pidStr := strings.TrimSpace(string(out))
			if pids := strings.Fields(pidStr); len(pids) > 0 {
				if pid, err := strconv.Atoi(pids[0]); err == nil {
					if p, err := process.NewProcess(int32(pid)); err == nil {
						if name, err := p.Name(); err == nil && name != "" {
							return fmt.Sprintf("%s (PID %d)", name, pid)
						}
					}
					return fmt.Sprintf("PID %d", pid)
				}
			}
		}
	}

	return ""
}

// checkPortFirewall inspects host firewall rules (UFW, Firewalld, iptables) on Linux
func checkPortFirewall(port int) FirewallInfo {
	if runtime.GOOS != "linux" {
		return FirewallInfo{
			Engine:  "local",
			Status:  "Local Environment",
			IsOpen:  true,
			Details: "Running on non-Linux development environment; OS socket firewall does not restrict local ports.",
		}
	}

	portStr := strconv.Itoa(port)

	// 1. Check UFW (Ubuntu / Debian standard)
	if _, err := exec.LookPath("ufw"); err == nil {
		out, err := exec.Command("ufw", "status").CombinedOutput()
		if err == nil {
			outStr := string(out)
			if strings.Contains(outStr, "Status: active") {
				isAllowed := false
				lines := strings.Split(outStr, "\n")
				for _, line := range lines {
					fields := strings.Fields(line)
					if len(fields) >= 2 {
						rulePort := fields[0]
						action := fields[1]
						if (rulePort == portStr || rulePort == portStr+"/tcp" || rulePort == portStr+"/udp") && strings.EqualFold(action, "ALLOW") {
							isAllowed = true
							break
						}
					}
				}

				if isAllowed {
					return FirewallInfo{
						Engine:  "ufw",
						Status:  "UFW: Port Open",
						IsOpen:  true,
						Details: fmt.Sprintf("Port %d is explicitly ALLOWED in active UFW firewall rules.", port),
					}
				}
				return FirewallInfo{
					Engine:  "ufw",
					Status:  "UFW: Port Blocked",
					IsOpen:  false,
					Details: fmt.Sprintf("UFW firewall is active and port %d is not allowed.", port),
					Command: fmt.Sprintf("ufw allow %d", port),
				}
			}
		}
	}

	// 2. Check Firewalld (CentOS / RHEL / AlmaLinux / RockyLinux)
	if _, err := exec.LookPath("firewall-cmd"); err == nil {
		stateOut, err := exec.Command("firewall-cmd", "--state").CombinedOutput()
		if err == nil && strings.Contains(string(stateOut), "running") {
			qTcp, _ := exec.Command("firewall-cmd", "--query-port="+portStr+"/tcp").CombinedOutput()
			qUdp, _ := exec.Command("firewall-cmd", "--query-port="+portStr+"/udp").CombinedOutput()
			isOpen := strings.Contains(string(qTcp), "yes") || strings.Contains(string(qUdp), "yes")

			if isOpen {
				return FirewallInfo{
					Engine:  "firewalld",
					Status:  "Firewalld: Port Open",
					IsOpen:  true,
					Details: fmt.Sprintf("Port %d is open in firewalld.", port),
				}
			}
			return FirewallInfo{
				Engine:  "firewalld",
				Status:  "Firewalld: Port Blocked",
				IsOpen:  false,
				Details: fmt.Sprintf("Firewalld is active and port %d is closed.", port),
				Command: fmt.Sprintf("firewall-cmd --add-port=%d/tcp --add-port=%d/udp --permanent && firewall-cmd --reload", port, port),
			}
		}
	}

	// 3. Check iptables INPUT chain policy
	if _, err := exec.LookPath("iptables"); err == nil {
		out, err := exec.Command("iptables", "-S", "INPUT").CombinedOutput()
		if err == nil {
			outStr := string(out)
			if strings.Contains(outStr, "-P INPUT DROP") {
				if strings.Contains(outStr, fmt.Sprintf("--dport %d -j ACCEPT", port)) {
					return FirewallInfo{
						Engine:  "iptables",
						Status:  "iptables: Port Open",
						IsOpen:  true,
						Details: fmt.Sprintf("Port %d has an explicit ACCEPT rule in iptables.", port),
					}
				}
				return FirewallInfo{
					Engine:  "iptables",
					Status:  "iptables: Port Blocked",
					IsOpen:  false,
					Details: fmt.Sprintf("iptables default INPUT policy is DROP and port %d is not accepted.", port),
					Command: fmt.Sprintf("iptables -I INPUT -p tcp --dport %d -j ACCEPT && iptables -I INPUT -p udp --dport %d -j ACCEPT", port, port),
				}
			}
		}
	}

	// Default: No blocking host firewall (Default ACCEPT)
	return FirewallInfo{
		Engine:  "unrestricted",
		Status:  "Server Rules: Unrestricted",
		IsOpen:  true,
		Details: "No active host firewall blocking this port (Default ACCEPT). If clients cannot connect externally, verify your Cloud Provider Security Group (AWS, Hetzner, Oracle, Cloudflare).",
	}
}
