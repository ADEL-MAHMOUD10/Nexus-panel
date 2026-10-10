package api

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"nexus/internal/logger"
)

// CertificateInfo contains metadata and file paths for an SSL certificate
type CertificateInfo struct {
	Domain   string `json:"domain"`
	CertFile string `json:"certFile"`
	KeyFile  string `json:"keyFile"`
	Issuer   string `json:"issuer"`
	Exists   bool   `json:"exists"`
	CertPem  string `json:"certPem,omitempty"`
	KeyPem   string `json:"keyPem,omitempty"`
}

func (s *Server) handleListCertificates(w http.ResponseWriter, r *http.Request) {
	certs := s.scanAllCertificates()
	defaultCert := s.getDefaultPanelCert()
	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"certificates": certs,
		"defaultCert":  defaultCert,
	})
}

func (s *Server) handleGetCertificate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Domain  string `json:"domain"`
		ReadPem bool   `json:"readPem"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Domain = r.URL.Query().Get("domain")
	}

	domain := strings.TrimSpace(strings.ToLower(req.Domain))
	if domain == "" {
		// Fallback to server_host setting or request host
		domain = s.db.GetSetting("server_host", "")
		if domain == "" {
			domain = r.Host
			if strings.Contains(domain, ":") {
				domain = strings.Split(domain, ":")[0]
			}
		}
	}

	certs := s.scanAllCertificates()
	var matched *CertificateInfo

	// 1. Exact match
	for _, c := range certs {
		if strings.EqualFold(c.Domain, domain) {
			matched = &c
			break
		}
	}

	// 2. Wildcard or Parent domain match (e.g. sub.example.com matches example.com or *.example.com)
	if matched == nil {
		parts := strings.Split(domain, ".")
		if len(parts) > 2 {
			parentDomain := strings.Join(parts[1:], ".")
			for _, c := range certs {
				if strings.EqualFold(c.Domain, parentDomain) || strings.EqualFold(c.Domain, "*."+parentDomain) {
					matched = &c
					break
				}
			}
		}
	}

	// 3. Fallback to default panel cert if exists
	if matched == nil {
		def := s.getDefaultPanelCert()
		if def != nil && def.Exists {
			matched = def
		}
	}

	suggestedCert := "/root/cert/" + domain + "/fullchain.pem"
	suggestedKey := "/root/cert/" + domain + "/privkey.pem"
	if runtime.GOOS == "windows" {
		suggestedCert = filepath.Join("data", "cert", domain, "fullchain.pem")
		suggestedKey = filepath.Join("data", "cert", domain, "privkey.pem")
	}

	if matched != nil {
		certPem := ""
		keyPem := ""
		if req.ReadPem || r.URL.Query().Get("readPem") == "1" {
			if b, err := os.ReadFile(matched.CertFile); err == nil {
				certPem = string(b)
			}
			if b, err := os.ReadFile(matched.KeyFile); err == nil {
				keyPem = string(b)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"success":  true,
			"found":    true,
			"domain":   matched.Domain,
			"certFile": matched.CertFile,
			"keyFile":  matched.KeyFile,
			"issuer":   matched.Issuer,
			"exists":   matched.Exists,
			"certPem":  certPem,
			"keyPem":   keyPem,
		})
		return
	}

	// No cert found on disk, return suggested standard paths
	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"found":    false,
		"domain":   domain,
		"certFile": suggestedCert,
		"keyFile":  suggestedKey,
		"exists":   false,
		"message":  "No existing SSL certificate found on disk for " + domain + ". Standard paths suggested.",
	})
}

func (s *Server) handleIssueCertificate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Domain string `json:"domain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Invalid request body"})
		return
	}

	domain := strings.TrimSpace(strings.ToLower(req.Domain))
	if domain == "" || strings.Contains(domain, " ") || strings.Contains(domain, "/") {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "Valid domain name required (FQDN)"})
		return
	}

	certDir := "/root/cert/" + domain
	fullchainPath := certDir + "/fullchain.pem"
	privkeyPath := certDir + "/privkey.pem"

	if runtime.GOOS == "windows" {
		// Windows dev environment: generate a self-signed P-256 certificate for testing
		baseDir := filepath.Join("data", "cert", domain)
		_ = os.MkdirAll(baseDir, 0755)
		fullchainPath = filepath.Join(baseDir, "fullchain.pem")
		privkeyPath = filepath.Join(baseDir, "privkey.pem")

		priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": err.Error()})
			return
		}

		serialNumber, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
		template := x509.Certificate{
			SerialNumber: serialNumber,
			Subject: pkix.Name{
				CommonName: domain,
			},
			NotBefore:             time.Now(),
			NotAfter:              time.Now().Add(365 * 24 * time.Hour),
			KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
			ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
			BasicConstraintsValid: true,
			DNSNames:              []string{domain, "*." + domain},
		}

		derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": err.Error()})
			return
		}

		certPem := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
		keyBytes, _ := x509.MarshalECPrivateKey(priv)
		keyPem := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})

		_ = os.WriteFile(fullchainPath, certPem, 0644)
		_ = os.WriteFile(privkeyPath, keyPem, 0600)

		writeJSON(w, http.StatusOK, map[string]any{
			"success":  true,
			"domain":   domain,
			"certFile": fullchainPath,
			"keyFile":  privkeyPath,
			"certPem":  string(certPem),
			"keyPem":   string(keyPem),
			"message":  "Test SSL Certificate generated successfully",
		})
		return
	}

	// Linux environment: Use acme.sh standalone issuance on port 80
	acmeCmd := "/root/.acme.sh/acme.sh"
	if _, err := os.Stat(acmeCmd); os.IsNotExist(err) {
		homeDir, _ := os.UserHomeDir()
		acmeCmd = filepath.Join(homeDir, ".acme.sh", "acme.sh")
	}

	// Check if acme.sh is installed, otherwise attempt auto-install
	if _, err := os.Stat(acmeCmd); os.IsNotExist(err) {
		logger.Infof("NEXUS: installing acme.sh for certificate generation...")
		installCmd := exec.Command("sh", "-c", "curl -s https://get.acme.sh | sh -s email=admin@"+domain)
		_ = installCmd.Run()
	}

	if _, err := os.Stat(acmeCmd); os.IsNotExist(err) {
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": "acme.sh is not installed on the system. Please run 'nexus ssl' from terminal or install acme.sh.",
		})
		return
	}

	_ = os.MkdirAll(certDir, 0755)

	logger.Infof("NEXUS: issuing SSL for domain %s via acme.sh standalone port 80...", domain)
	issueScript := fmt.Sprintf(
		`%s --set-default-ca --server letsencrypt && %s --issue -d %s --standalone --keylength ec-256 --force && %s --install-cert -d %s --ecc --fullchain-file %s --key-file %s`,
		acmeCmd, acmeCmd, domain, acmeCmd, domain, fullchainPath, privkeyPath,
	)

	cmd := exec.Command("bash", "-c", issueScript)
	out, err := cmd.CombinedOutput()
	outputStr := string(out)

	if err != nil || !fileExists(fullchainPath) || !fileExists(privkeyPath) {
		logger.Errorf("NEXUS: SSL issuance failed for %s: %v\nOutput: %s", domain, err, outputStr)
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": "SSL issuance failed. Make sure your domain points to this server IP and port 80 is not blocked.",
			"output":  outputStr,
		})
		return
	}

	logger.Infof("NEXUS: SSL certificate successfully issued for %s", domain)
	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"domain":   domain,
		"certFile": fullchainPath,
		"keyFile":  privkeyPath,
		"message":  "SSL Certificate issued successfully via Let's Encrypt!",
	})
}

func (s *Server) scanAllCertificates() []CertificateInfo {
	var results []CertificateInfo
	visited := make(map[string]bool)

	// Search paths
	scanDirs := []struct {
		base   string
		issuer string
	}{
		{"/root/cert", "acme.sh"},
		{"/etc/letsencrypt/live", "certbot"},
		{"/usr/local/nexus/cert", "nexus"},
		{"data/cert", "local"},
		{"cert", "local"},
	}

	for _, sd := range scanDirs {
		if entries, err := os.ReadDir(sd.base); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					domain := entry.Name()
					dirPath := filepath.Join(sd.base, domain)
					certFile := findCertFile(dirPath)
					keyFile := findKeyFile(dirPath)

					if certFile != "" && keyFile != "" {
						key := strings.ToLower(domain)
						if !visited[key] {
							visited[key] = true
							results = append(results, CertificateInfo{
								Domain:   domain,
								CertFile: certFile,
								KeyFile:  keyFile,
								Issuer:   sd.issuer,
								Exists:   true,
							})
						}
					}
				}
			}
		}
	}

	return results
}

func (s *Server) getDefaultPanelCert() *CertificateInfo {
	certFile := s.db.GetSetting("web_cert_file", "")
	if certFile == "" {
		certFile = s.db.GetSetting("ssl_cert_file", "")
	}
	keyFile := s.db.GetSetting("web_key_file", "")
	if keyFile == "" {
		keyFile = s.db.GetSetting("ssl_key_file", "")
	}

	if certFile != "" && keyFile != "" {
		return &CertificateInfo{
			Domain:   "Panel Default",
			CertFile: certFile,
			KeyFile:  keyFile,
			Issuer:   "Panel Settings",
			Exists:   fileExists(certFile) && fileExists(keyFile),
		}
	}
	return nil
}

func findCertFile(dir string) string {
	candidates := []string{"fullchain.pem", "cert.pem", "certificate.crt", "server.crt", "cert.crt"}
	for _, c := range candidates {
		p := filepath.Join(dir, c)
		if fileExists(p) {
			return filepath.ToSlash(p)
		}
	}
	return ""
}

func findKeyFile(dir string) string {
	candidates := []string{"privkey.pem", "key.pem", "private.key", "server.key", "cert.key"}
	for _, c := range candidates {
		p := filepath.Join(dir, c)
		if fileExists(p) {
			return filepath.ToSlash(p)
		}
	}
	return ""
}

func fileExists(p string) bool {
	if p == "" {
		return false
	}
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}
