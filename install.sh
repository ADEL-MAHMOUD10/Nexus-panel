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

# 2. Complete OS & Architecture detection
OS_TYPE="unknown"
OS_VER=""
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS_TYPE=$ID
    OS_VER=$VERSION_ID
elif [[ -f /etc/debian_version ]]; then
    OS_TYPE="debian"
elif [[ -f /etc/redhat-release ]]; then
    OS_TYPE="rhel"
fi

ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)  XRAY_ARCH="64"        GO_ARCH="amd64" ;;
    aarch64|arm64) XRAY_ARCH="arm64-v8a" GO_ARCH="arm64" ;;
    armv7l|armv7)  XRAY_ARCH="arm32-v7a" GO_ARCH="armv7" ;;
    *)
        log_err "Unsupported CPU architecture: $ARCH"
        exit 1
        ;;
esac

log_info "Detected OS Distribution : ${OS_TYPE} ${OS_VER}"
log_info "Detected CPU Architecture : ${ARCH} (Target: ${GO_ARCH}, Xray Core: ${XRAY_ARCH})"

# 3. Install prerequisites based on specific package manager
log_info "Checking and installing dependencies (curl, tar, socat, unzip)..."
if command -v apt-get &>/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y && apt-get install -y curl tar socat ca-certificates unzip
elif command -v dnf &>/dev/null; then
    dnf install -y curl tar socat ca-certificates unzip
elif command -v yum &>/dev/null; then
    yum install -y curl tar socat ca-certificates unzip
elif command -v pacman &>/dev/null; then
    pacman -Sy --noconfirm curl tar socat ca-certificates unzip
elif command -v apk &>/dev/null; then
    apk update && apk add curl tar socat ca-certificates unzip
else
    log_warn "Unknown package manager. Proceeding with existing system tools..."
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

# 6. Fetch Nexus binary and CLI scripts
GITHUB_REPO="ADEL-MAHMOUD10/Nexus-panel"
RAW_URL="https://raw.githubusercontent.com/${GITHUB_REPO}/main"

# Download CLI script
if [[ -f "./scripts/nexus.sh" ]]; then
    cp -f "./scripts/nexus.sh" "${NEXUS_DIR}/nexus.sh"
else
    log_info "Downloading nexus CLI helper..."
    curl -sL "${RAW_URL}/scripts/nexus.sh" -o "${NEXUS_DIR}/nexus.sh"
fi
chmod +x "${NEXUS_DIR}/nexus.sh"
ln -sf "${NEXUS_DIR}/nexus.sh" "/usr/bin/nexus"
ln -sf "${NEXUS_DIR}/nexus.sh" "/usr/local/bin/nexus"

# Download or copy Nexus core binary
TMP_NEXUS="${NEXUS_DIR}/nexus.new"
if [[ -f "./nexus" ]]; then
    cp -f "./nexus" "${TMP_NEXUS}"
elif [[ -f "./bin/nexus-linux-${GO_ARCH}" ]]; then
    cp -f "./bin/nexus-linux-${GO_ARCH}" "${TMP_NEXUS}"
else
    log_info "Fetching Nexus server binary for ${GO_ARCH}..."
    curl -fL --progress-bar "${RAW_URL}/bin/nexus-linux-${GO_ARCH}" -o "${TMP_NEXUS}" || {
        log_warn "Raw download failed, trying release download..."
        curl -fL --progress-bar "https://github.com/${GITHUB_REPO}/releases/latest/download/nexus-linux-${GO_ARCH}" -o "${TMP_NEXUS}" || true
    }
fi

if [[ -f "${TMP_NEXUS}" && -s "${TMP_NEXUS}" ]]; then
    chmod 755 "${TMP_NEXUS}"
    mv -f "${TMP_NEXUS}" "${NEXUS_DIR}/nexus"
    LATEST_TAG=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [[ -z "$LATEST_TAG" ]]; then LATEST_TAG="v1.0.5"; fi
    echo "${LATEST_TAG}" > "${NEXUS_DIR}/version"
fi

# Verify nexus binary integrity
if [[ ! -x "${NEXUS_DIR}/nexus" ]]; then
    log_warn "Binary download failed or not executable. Attempting emergency compile if go is present..."
    if command -v go &>/dev/null; then
        log_info "Building Nexus binary from source using Go..."
        TMP_SRC=$(mktemp -d)
        git clone "https://github.com/${GITHUB_REPO}.git" "${TMP_SRC}"
        cd "${TMP_SRC}"
        go build -ldflags="-s -w" -o "${NEXUS_DIR}/nexus" ./cmd/server
        chmod +x "${NEXUS_DIR}/nexus"
        rm -rf "${TMP_SRC}"
        cd - >/dev/null 2>&1
    fi
fi

if [[ ! -x "${NEXUS_DIR}/nexus" ]]; then
    log_err "Failed to obtain executable Nexus binary for ${GO_ARCH}!"
    log_err "Please ensure the binary exists in repository or install Go on the server."
    exit 1
fi
log_info "Nexus server binary verified and ready."

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
