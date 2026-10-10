#!/bin/bash

# ==============================================================================
#  Nexus Panel Management Terminal CLI
#  Command: nexus
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
PLAIN='\033[0m'

NEXUS_DIR="/usr/local/nexus"
NEXUS_BIN="${NEXUS_DIR}/nexus"
SERVICE_NAME="nexus"
CERT_DIR="/root/cert"

log_info() { echo -e "${GREEN}[INFO] $*${PLAIN}"; }
log_warn() { echo -e "${YELLOW}[WARN] $*${PLAIN}"; }
log_err()  { echo -e "${RED}[ERROR] $*${PLAIN}"; }

# Check root privilege
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_err "You must run this script as root! (use: sudo nexus)"
        exit 1
    fi
}

check_root

# ------------------------------------------------------------------------------
# Service Controls
# ------------------------------------------------------------------------------
status() {
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        echo -e "Nexus Status: ${GREEN}Running${PLAIN}"
        return 0
    else
        echo -e "Nexus Status: ${RED}Stopped${PLAIN}"
        return 1
    fi
}

start() {
    if status >/dev/null 2>&1; then
        log_warn "Nexus is already running!"
    else
        systemctl start "${SERVICE_NAME}"
        sleep 1
        if status >/dev/null 2>&1; then
            log_info "Nexus started successfully."
        else
            log_err "Failed to start Nexus. Check logs: journalctl -u nexus -n 50"
        fi
    fi
}

stop() {
    if ! status >/dev/null 2>&1; then
        log_warn "Nexus is already stopped."
    else
        systemctl stop "${SERVICE_NAME}"
        sleep 1
        log_info "Nexus stopped successfully."
    fi
}

restart() {
    systemctl restart "${SERVICE_NAME}"
    sleep 1
    if status >/dev/null 2>&1; then
        log_info "Nexus restarted successfully."
    else
        log_err "Failed to restart Nexus. Check logs: journalctl -u nexus -n 50"
    fi
}

show_logs() {
    echo -e "${CYAN}Streaming Nexus logs (Press Ctrl+C to exit)...${PLAIN}"
    journalctl -u "${SERVICE_NAME}" -f -n 100 --no-pager
}

# ------------------------------------------------------------------------------
# Settings Management (via CLI flags or direct config)
# ------------------------------------------------------------------------------
change_port() {
    read -rp "Enter new panel port (1-65535): " new_port
    if [[ "$new_port" =~ ^[0-9]+$ ]] && [ "$new_port" -ge 1 ] && [ "$new_port" -le 65535 ]; then
        if [[ -x "${NEXUS_BIN}" ]]; then
            "${NEXUS_BIN}" -cli -set-port "${new_port}"
            log_info "Port set to ${new_port}. Restarting panel..."
            restart
        else
            log_err "Nexus binary not found at ${NEXUS_BIN}"
        fi
    else
        log_err "Invalid port number!"
    fi
}

reset_credentials() {
    read -rp "Enter new admin username: " new_user
    read -s -rp "Enter new admin password: " new_pass
    echo ""
    if [[ -n "$new_user" && -n "$new_pass" ]]; then
        if [[ -x "${NEXUS_BIN}" ]]; then
            "${NEXUS_BIN}" -cli -reset-admin -username "${new_user}" -password "${new_pass}"
            log_info "Admin credentials updated successfully! Restarting panel..."
            restart
        else
            log_err "Nexus binary not found at ${NEXUS_BIN}"
        fi
    else
        log_err "Username or password cannot be empty!"
    fi
}

# ------------------------------------------------------------------------------
# SSL Certificate Management (acme.sh)
# ------------------------------------------------------------------------------
install_acme() {
    if ! command -v ~/.acme.sh/acme.sh &>/dev/null; then
        log_info "Installing acme.sh..."
        curl -s https://get.acme.sh | sh -s email="admin@$(hostname -f 2>/dev/null || echo 'nexus.local')"
        source ~/.bashrc 2>/dev/null
    fi
}

issue_ssl_domain() {
    install_acme
    read -rp "Enter your domain name (pointed to this VPS IP): " domain
    if [[ -z "$domain" ]]; then
        log_err "Domain cannot be empty!"
        return 1
    fi

    mkdir -p "${CERT_DIR}/${domain}"
    log_info "Requesting SSL for ${domain} using HTTP-01 on port 80..."
    log_warn "Make sure port 80 is open and not blocked by firewall."

    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
    ~/.acme.sh/acme.sh --issue -d "${domain}" --standalone --keylength ec-256 --force

    if [ $? -eq 0 ]; then
        ~/.acme.sh/acme.sh --install-cert -d "${domain}" --ecc \
            --fullchain-file "${CERT_DIR}/${domain}/fullchain.pem" \
            --key-file "${CERT_DIR}/${domain}/privkey.pem" \
            --reloadcmd "systemctl restart ${SERVICE_NAME}"

        log_info "SSL Certificate issued successfully!"
        echo -e "Cert File: ${GREEN}${CERT_DIR}/${domain}/fullchain.pem${PLAIN}"
        echo -e "Key File : ${GREEN}${CERT_DIR}/${domain}/privkey.pem${PLAIN}"
    else
        log_err "SSL issuance failed! Check that domain DNS points to this server IP and port 80 is open."
    fi
}

issue_ssl_cloudflare() {
    install_acme
    read -rp "Enter your Cloudflare Global API Key or Token: " cf_key
    read -rp "Enter your Cloudflare Email: " cf_email
    read -rp "Enter your Domain name (*.domain.com or domain.com): " domain

    export CF_Key="${cf_key}"
    export CF_Email="${cf_email}"

    mkdir -p "${CERT_DIR}/${domain}"
    log_info "Issuing SSL certificate via Cloudflare DNS API..."
    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
    ~/.acme.sh/acme.sh --issue --dns dns_cf -d "${domain}" -d "*.${domain}" --keylength ec-256 --force

    if [ $? -eq 0 ]; then
        ~/.acme.sh/acme.sh --install-cert -d "${domain}" --ecc \
            --fullchain-file "${CERT_DIR}/${domain}/fullchain.pem" \
            --key-file "${CERT_DIR}/${domain}/privkey.pem" \
            --reloadcmd "systemctl restart ${SERVICE_NAME}"

        log_info "Cloudflare DNS SSL issued successfully!"
        echo -e "Cert: ${CERT_DIR}/${domain}/fullchain.pem"
        echo -e "Key : ${CERT_DIR}/${domain}/privkey.pem"
    else
        log_err "Cloudflare SSL issuance failed. Check credentials and domain name."
    fi
}

ssl_menu() {
    echo -e "
${CYAN}--- SSL Certificate Management ---${PLAIN}
  ${GREEN}1.${PLAIN} Issue SSL for Domain (Standalone Port 80)
  ${GREEN}2.${PLAIN} Issue SSL via Cloudflare DNS API (Wildcard support)
  ${GREEN}3.${PLAIN} Renew All Certificates
  ${GREEN}4.${PLAIN} List Installed Certificates
  ${GREEN}0.${PLAIN} Back to Main Menu
"
    read -rp "Select option [0-4]: " ssl_opt
    case "$ssl_opt" in
        1) issue_ssl_domain ;;
        2) issue_ssl_cloudflare ;;
        3) ~/.acme.sh/acme.sh --renew-all --force ;;
        4) ls -la "${CERT_DIR}" 2>/dev/null || echo "No certificates found." ;;
        0) return ;;
        *) log_err "Invalid selection" ;;
    esac
}

# ------------------------------------------------------------------------------
# BBR Congestion Control Optimization
# ------------------------------------------------------------------------------
enable_bbr() {
    current_cc=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null)
    if [[ "$current_cc" == "bbr" ]]; then
        log_info "BBR is already enabled and active!"
        return
    fi

    log_info "Enabling TCP BBR..."
    cat > /etc/sysctl.d/99-nexus-bbr.conf <<EOF
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
EOF
    sysctl -p /etc/sysctl.d/99-nexus-bbr.conf >/dev/null 2>&1
    if [[ $(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null) == "bbr" ]]; then
        log_info "BBR successfully enabled!"
    else
        log_err "Failed to activate BBR. Please verify Linux kernel >= 4.9."
    fi
}

# ------------------------------------------------------------------------------
# Update Nexus Panel Binary
# ------------------------------------------------------------------------------
update_panel() {
    log_info "Checking CPU architecture..."
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)  GO_ARCH="amd64" ;;
        aarch64|arm64) GO_ARCH="arm64" ;;
        *) log_err "Unsupported CPU architecture: $ARCH"; return 1 ;;
    esac

    log_info "Downloading latest Nexus Panel binary (${GO_ARCH})..."
    TMP_NEXUS="${NEXUS_DIR}/nexus.new"
    GITHUB_REPO="ADEL-MAHMOUD10/Nexus-panel"
    curl -fL --progress-bar "https://github.com/${GITHUB_REPO}/releases/latest/download/nexus-linux-${GO_ARCH}" -o "${TMP_NEXUS}" || {
        log_warn "Release asset download failed, attempting repository main download..."
        curl -fL --progress-bar "https://raw.githubusercontent.com/${GITHUB_REPO}/main/bin/nexus-linux-${GO_ARCH}" -o "${TMP_NEXUS}" || true
    }

    if [[ -f "${TMP_NEXUS}" && -s "${TMP_NEXUS}" ]]; then
        chmod 755 "${TMP_NEXUS}"
        mv -f "${TMP_NEXUS}" "${NEXUS_BIN}"
        log_info "Binary updated successfully. Restarting Nexus service..."
        restart
    else
        log_err "Failed to download update binary!"
    fi
}

# ------------------------------------------------------------------------------
# Main Interactive CLI Menu
# ------------------------------------------------------------------------------
show_menu() {
    clear
    echo -e "
${PURPLE}╔═══════════════════════════════════════════════════════╗
║               ${CYAN}NEXUS CONTROL PANEL CLI${PURPLE}                 ║
║           High-Performance & Minimal Footprint        ║
╚═══════════════════════════════════════════════════════╝${PLAIN}
"
    status
    echo -e "
${GREEN} 1.${PLAIN} Start Nexus
${GREEN} 2.${PLAIN} Stop Nexus
${GREEN} 3.${PLAIN} Restart Nexus
${GREEN} 4.${PLAIN} Check Service Status
${GREEN} 5.${PLAIN} View Live Logs
─────────────────────────────────────────────────────────
${GREEN} 6.${PLAIN} Change Panel Web Port
${GREEN} 7.${PLAIN} Reset Admin Username & Password
${GREEN} 8.${PLAIN} SSL Certificate Management (Let's Encrypt / CF)
${GREEN} 9.${PLAIN} Enable TCP BBR Acceleration
─────────────────────────────────────────────────────────
${GREEN}10.${PLAIN} Enable Autostart on Boot
${GREEN}11.${PLAIN} Disable Autostart on Boot
${GREEN}12.${PLAIN} Update Nexus Panel
${GREEN}13.${PLAIN} Uninstall Nexus
─────────────────────────────────────────────────────────
${RED} 0.${PLAIN} Exit
"
    read -rp "Please enter selection [0-13]: " opt
    case "$opt" in
        1) start ;;
        2) stop ;;
        3) restart ;;
        4) status ;;
        5) show_logs ;;
        6) change_port ;;
        7) reset_credentials ;;
        8) ssl_menu ;;
        9) enable_bbr ;;
        10) systemctl enable "${SERVICE_NAME}" && log_info "Autostart enabled." ;;
        11) systemctl disable "${SERVICE_NAME}" && log_info "Autostart disabled." ;;
        12) update_panel ;;
        13) 
            read -rp "Are you sure you want to uninstall Nexus? (y/N): " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                systemctl stop "${SERVICE_NAME}" 2>/dev/null
                systemctl disable "${SERVICE_NAME}" 2>/dev/null
                rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
                systemctl daemon-reload
                rm -rf "${NEXUS_DIR}"
                rm -f "/usr/bin/nexus"
                log_info "Nexus has been completely uninstalled."
                exit 0
            fi
            ;;
        0) exit 0 ;;
        *) log_err "Invalid selection!" ;;
    esac
}

# Process direct arguments if supplied (e.g., 'nexus start')
if [[ $# -gt 0 ]]; then
    case "$1" in
        start) start ;;
        stop) stop ;;
        restart) restart ;;
        status) status ;;
        log|logs) show_logs ;;
        port) change_port ;;
        bbr) enable_bbr ;;
        ssl) ssl_menu ;;
        update) update_panel ;;
        *) echo "Usage: nexus {start|stop|restart|status|logs|port|bbr|ssl|update}" ;;
    esac
else
    show_menu
fi
