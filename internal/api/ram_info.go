package api

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

// RAMHardwareInfo holds hardware architecture details about installed RAM
type RAMHardwareInfo struct {
	Type     string `json:"type"`     // e.g. "DDR4", "DDR5", "LPDDR4"
	SpeedMHz int    `json:"speedMHz"` // e.g. 3200
	Display  string `json:"display"`  // e.g. "DDR4 @ 3200 MHz"
}

var (
	ramInfoCached     RAMHardwareInfo
	ramInfoCachedOnce sync.Once
)

// GetRAMHardwareInfo dynamically detects RAM generation (DDR3/4/5) and operating frequency
func GetRAMHardwareInfo(cpuModel string) RAMHardwareInfo {
	ramInfoCachedOnce.Do(func() {
		ramInfoCached = detectRAMHardwareInfo(cpuModel)
	})
	return ramInfoCached
}

func detectRAMHardwareInfo(cpuModel string) RAMHardwareInfo {
	var info RAMHardwareInfo
	if runtime.GOOS == "windows" {
		info = detectRAMWindows()
	} else if runtime.GOOS == "linux" {
		info = detectRAMLinux(cpuModel)
	}

	if info.Type == "" {
		info.Type = "DDR4"
	}
	if info.SpeedMHz <= 0 {
		info.SpeedMHz = 3200
	}

	info.Display = formatRAMDisplay(info.Type, info.SpeedMHz)
	return info
}

func detectRAMLinux(cpuModel string) RAMHardwareInfo {
	var info RAMHardwareInfo

	// 1. Query dmidecode -t 17 (DMI Type 17: Memory Device)
	out, err := exec.Command("dmidecode", "-t", "17").Output()
	if err == nil && len(out) > 0 {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Type:") {
				t := strings.TrimSpace(strings.TrimPrefix(line, "Type:"))
				if t != "" && t != "Unknown" && t != "None" && t != "Other" && t != "RAM" {
					info.Type = t
				}
			}
			if strings.HasPrefix(line, "Configured Memory Speed:") || strings.HasPrefix(line, "Speed:") {
				parts := strings.Split(line, ":")
				if len(parts) >= 2 {
					spStr := strings.TrimSpace(parts[1])
					fields := strings.Fields(spStr)
					if len(fields) > 0 {
						if n, err := strconv.Atoi(fields[0]); err == nil && n > 0 {
							if info.SpeedMHz == 0 || strings.HasPrefix(line, "Configured Memory Speed:") {
								info.SpeedMHz = n
							}
						}
					}
				}
			}
		}
	}

	// 2. Query lshw -C memory if dmidecode missed type or speed
	if info.Type == "" || info.SpeedMHz == 0 {
		outLshw, err := exec.Command("lshw", "-C", "memory", "-short").Output()
		if err == nil {
			s := string(outLshw)
			for _, ddr := range []string{"DDR5", "DDR4", "DDR3", "LPDDR5", "LPDDR4"} {
				if strings.Contains(s, ddr) {
					if info.Type == "" {
						info.Type = ddr
					}
					break
				}
			}
		}
	}

	// 3. Cloud Hypervisor & Architecture Heuristics (e.g., KVM virtualization where DMI is hidden)
	if info.Type == "" || info.SpeedMHz == 0 {
		mLower := strings.ToLower(cpuModel)
		if strings.Contains(mLower, "genoa") || strings.Contains(mLower, "sapphire") || strings.Contains(mLower, "emerald") || strings.Contains(mLower, "zen 4") {
			if info.Type == "" {
				info.Type = "DDR5"
			}
			if info.SpeedMHz == 0 {
				info.SpeedMHz = 4800
			}
		} else if strings.Contains(mLower, "milan") || strings.Contains(mLower, "rome") || strings.Contains(mLower, "cascade") || strings.Contains(mLower, "ice lake") || strings.Contains(mLower, "neoverse") || strings.Contains(mLower, "ampere") || strings.Contains(mLower, "kunpeng") {
			if info.Type == "" {
				info.Type = "DDR4"
			}
			if info.SpeedMHz == 0 {
				info.SpeedMHz = 3200
			}
		}
	}

	return info
}

func detectRAMWindows() RAMHardwareInfo {
	var info RAMHardwareInfo
	cmd := exec.Command("powershell", "-NoProfile", "-Command", "$m = Get-CimInstance Win32_PhysicalMemory | Select-Object -First 1; if ($m) { Write-Output \"$($m.Speed)|$($m.SMBIOSMemoryType)\" }")
	out, err := cmd.Output()
	if err == nil {
		parts := strings.Split(strings.TrimSpace(string(out)), "|")
		if len(parts) == 2 {
			speed, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
			smbiosType, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
			info.SpeedMHz = speed
			switch smbiosType {
			case 26:
				info.Type = "DDR4"
			case 34:
				info.Type = "DDR5"
			case 35:
				info.Type = "LPDDR5"
			case 24:
				info.Type = "DDR3"
			case 27, 28, 29:
				info.Type = "LPDDR4"
			}
		}
	}
	return info
}

func formatRAMDisplay(ramType string, speedMHz int) string {
	if ramType != "" && speedMHz > 0 {
		return ramType + " @ " + strconv.Itoa(speedMHz) + " MHz"
	}
	if ramType != "" {
		return ramType
	}
	if speedMHz > 0 {
		return strconv.Itoa(speedMHz) + " MHz"
	}
	return "DDR4 @ 3200 MHz"
}
