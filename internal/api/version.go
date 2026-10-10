package api

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime/debug"
	"strings"
)

// BuildVersion can be injected at compile time via -ldflags="-X 'nexus/internal/api.BuildVersion=v1.0.1'"
var BuildVersion string

// GetPanelVersion dynamically resolves the currently installed Panel version
func GetPanelVersion() string {
	// 1. Check version file created during installation / update
	var versionFiles []string
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		versionFiles = append(versionFiles, filepath.Join(dir, "version"), filepath.Join(dir, "VERSION"))
	}
	versionFiles = append(versionFiles,
		"/usr/local/nexus/version",
		"/usr/local/nexus/VERSION",
		"version",
		"VERSION",
		"data/version",
	)

	for _, vf := range versionFiles {
		if b, err := os.ReadFile(vf); err == nil {
			v := strings.TrimSpace(string(b))
			if v != "" {
				if !strings.HasPrefix(v, "v") {
					v = "v" + v
				}
				return v
			}
		}
	}

	// 2. Check build-time injected version
	if BuildVersion != "" {
		v := strings.TrimSpace(BuildVersion)
		if !strings.HasPrefix(v, "v") {
			v = "v" + v
		}
		return v
	}

	// 3. Check git tag if repo exists
	if out, err := exec.Command("git", "describe", "--tags", "--abbrev=0").Output(); err == nil {
		v := strings.TrimSpace(string(out))
		if v != "" {
			return v
		}
	}

	// 4. Check runtime build info
	if bi, ok := debug.ReadBuildInfo(); ok && bi.Main.Version != "" && bi.Main.Version != "(devel)" {
		v := strings.TrimSpace(bi.Main.Version)
		if !strings.HasPrefix(v, "v") {
			v = "v" + v
		}
		return v
	}

	return "v1.0.1"
}

// SetInstalledPanelVersion records the newly installed version to the persistent version file
func SetInstalledPanelVersion(version string) {
	if version == "" {
		return
	}
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}

	var targetPaths []string
	if exe, err := os.Executable(); err == nil {
		targetPaths = append(targetPaths, filepath.Join(filepath.Dir(exe), "version"))
	}
	targetPaths = append(targetPaths, "/usr/local/nexus/version", "version")

	for _, p := range targetPaths {
		dir := filepath.Dir(p)
		if err := os.MkdirAll(dir, 0755); err == nil {
			_ = os.WriteFile(p, []byte(version+"\n"), 0644)
		}
	}
}
