#!/bin/bash

# ==============================================================================
#  Nexus Panel 1-Click Installation Script for VPS
#  Supports: Ubuntu, Debian, CentOS, AlmaLinux, RockyLinux
#  Architectures: x86_64 (amd64), aarch64 (arm64)
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
PLAIN='\033[0m'

NEXUS_DIR="/usr/local/nexus"
NEXUS_BIN_DIR="${NEXUS_DIR}/bin"
NEXUS_DATA_DIR="${NEXUS_DIR}/data"

log_info() { echo -e "${GREEN}[INFO] $*${PLAIN}"; }
log_warn() { echo -e "${YELLOW}[WARN] $*${PLAIN}"; }
log_err()  { echo -e "${RED}[ERROR] $*${PLAIN}"; }

echo -e "
${PURPLE}╔═══════════════════════════════════════════════════════╗
║               ${CYAN}NEXUS PANEL INSTALLER${PURPLE}                   ║
║         Lightweight High-Performance Xray Panel       ║
╚═══════════════════════════════════════════════════════╝${PLAIN}
"

# 1. Root check
if [[ $EUID -ne 0 ]]; then
    log_err "This installer must be run as root! (use: sudo bash install.sh)"
    exit 1
fi

# 2. Architecture detection
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  XRAY_ARCH="64"    GO_ARCH="amd64" ;;
    aarch64) XRAY_ARCH="arm64-v8a" GO_ARCH="arm64" ;;
    armv7l)  XRAY_ARCH="arm32-v7a" GO_ARCH="armv7" ;;
    *)
        log_err "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac
log_info "Detected architecture: ${ARCH} (Xray: ${XRAY_ARCH})"

# 3. Install prerequisites
log_info "Updating packages and installing prerequisites (curl, tar, socat)..."
if command -v apt-get &>/dev/null; then
    apt-get update -y && apt-get install -y curl tar socat ca-certificates
elif command -v yum &>/dev/null; then
    yum install -y curl tar socat ca-certificates
fi

# 4. Prepare directory layout
mkdir -p "${NEXUS_DIR}"
mkdir -p "${NEXUS_BIN_DIR}"
mkdir -p "${NEXUS_DATA_DIR}"
mkdir -p "/root/cert"

# 5. Download latest official Xray-core release
log_info "Downloading official Xray-core binary..."
XRAY_LATEST_TAG=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
if [[ -z "$XRAY_LATEST_TAG" ]]; then
    XRAY_LATEST_TAG="v24.11.30"
fi
log_info "Installing Xray-core (${XRAY_LATEST_TAG})..."
XRAY_ZIP_URL="https://github.com/XTLS/Xray-core/releases/download/${XRAY_LATEST_TAG}/Xray-linux-${XRAY_ARCH}.zip"

TMP_DIR=$(mktemp -d)
curl -sL "${XRAY_ZIP_URL}" -o "${TMP_DIR}/xray.zip"
if command -v unzip &>/dev/null; then
    unzip -q -o "${TMP_DIR}/xray.zip" -d "${NEXUS_BIN_DIR}"
else
    if command -v apt-get &>/dev/null; then apt-get install -y unzip; else yum install -y unzip; fi
    unzip -q -o "${TMP_DIR}/xray.zip" -d "${NEXUS_BIN_DIR}"
fi
rm -rf "${TMP_DIR}"
chmod +x "${NEXUS_BIN_DIR}/xray"
log_info "Xray-core binary ready at ${NEXUS_BIN_DIR}/xray"

# 6. Copy or build Nexus binary and scripts
if [[ -f "./nexus" ]]; then
    cp -f "./nexus" "${NEXUS_DIR}/nexus"
    chmod +x "${NEXUS_DIR}/nexus"
fi

if [[ -f "./scripts/nexus.sh" ]]; then
    cp -f "./scripts/nexus.sh" "${NEXUS_DIR}/nexus.sh"
    chmod +x "${NEXUS_DIR}/nexus.sh"
    ln -sf "${NEXUS_DIR}/nexus.sh" "/usr/bin/nexus"
fi

# 7. Configure Systemd Service
log_info "Configuring systemd service (nexus.service)..."
cat > /etc/systemd/system/nexus.service <<EOF
[Unit]
Description=Nexus Xray Control Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${NEXUS_DIR}
ExecStart=${NEXUS_DIR}/nexus
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexus.service
systemctl restart nexus.service

SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "YOUR_VPS_IP")

echo -e "
${GREEN}═════════════════════════════════════════════════════════${PLAIN}
${CYAN}       Nexus Panel has been installed successfully!     ${PLAIN}
${GREEN}═════════════════════════════════════════════════════════${PLAIN}

  ${YELLOW}Dashboard URL :${PLAIN} http://${SERVER_IP}:8443
  ${YELLOW}Username      :${PLAIN} admin
  ${YELLOW}Password      :${PLAIN} admin

  ${CYAN}Terminal CLI  :${PLAIN} Type ${GREEN}nexus${PLAIN} anytime to open the management menu!
  ${CYAN}Service Logs  :${PLAIN} journalctl -u nexus -f
${GREEN}═════════════════════════════════════════════════════════${PLAIN}
"
