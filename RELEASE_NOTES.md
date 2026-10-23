# Nexus v1.1.0 — Enterprise Release

> **Release Tag:** `v1.1.0`  
> **Kernel Compatibility:** Xray-core `v26.10.x` & `v26.9.x`  
> **Platforms:** Linux `amd64` / `arm64`, Windows `x64`

---

## 🌟 Highlights

Nexus `v1.1.0` delivers an all-new executive design language, an intelligent notification & toast management system, advanced hardware telemetry diagnostics, and a responsive architectural canvas with the signature Nexus monogram insignia.

---

## 🚀 What's New in v1.1.0

### 💎 1. Premium Obsidian Black Design Language
- **Obsidian Dark Canvas:** Replaced bright gaming neon aesthetics with an executive, minimalist dark interface (`#07080b`) inspired by Linear, Vercel, and Apple Dark Mode.
- **Dark Frosted Glassmorphism:** Elevated cards and panels with `backdrop-blur-xl`, `bg-[#0c0d13]/85`, and hairline specular borders (`border-white/[0.08]`).
- **Unified Full-Window Continuity:** Seamless background integration across `#root`, sidebar, header, and content areas without disjointed blocks or sharp contrast cutoffs.
- **Architectural Vector Geometry & Nexus Monogram:**
  - Integrated a bespoke SVG background canvas with fine 40px grid dot intersections, diagonal rays, and geometric facets.
  - Scalable signature Nexus `N` monogram watermark rendered with responsive `viewBox="0 0 1600 1000"` and `preserveAspectRatio="xMidYMid slice"` across all screen resolutions.

### 🔔 2. Next-Gen Toast & Notification Engine
- **Live Interactive Toasts:** Smooth sliding toast messages with animated time-to-live progress bars.
- **Persistent Header Notification Center:**
  - Notification drawer with categories (`System`, `Security`, `Clients`, `Core`).
  - Unread count badges, relative timestamps, and bulk actions (*"Mark all as read"*, *"Clear all"*).
- **Anti-Spam & Deduplication System:**
  - Prevents identical toasts from stacking up.
  - Concurrency queue capped at max 3 visible toasts.
  - Guarded single-fire update check that notifies once per release to eliminate polling loop spam.

### 🖥️ 3. Deep Hardware & Engine Diagnostics
- **RAM Telemetry:** Displays exact RAM hardware type and bus speed (e.g., `DDR4 @ 3200 MHz`), memory utilization %, and used vs. free memory indicators.
- **Processor Diagnostics:** Full CPU model string, current clock speed in GHz, core count, load percentage, and rolling performance sparklines.
- **Extended Resources:** Real-time SWAP tracking, storage partition utilization, and active open socket tracking (TCP/UDP).
- **Dual-Stream Traffic Chart:** Ultra-smooth real-time ingress/egress bandwidth monitoring with peak speed tracking and high-precision dark tooltips.

### ⚡ 4. Proxy Engine & Management Suite
- **One-Click Kernel Controls:** Instant Xray core restarts and runtime synchronization with operational status badges.
- **In-Panel Updates Manager:** Dedicated modal to check, verify, and upgrade both the Nexus Panel Daemon and Xray-core directly from GitHub releases.
- **Protocol & Inbound Management:** Support for VLESS, VMess, Trojan, Shadowsocks, TUIC, and Hysteria with REALITY and TLS configuration helpers.
- **Client Accounting:** Client bandwidth quotas, expiration timers, live connection status, QR code generation, and 1-click subscription link sharing.

---

## 📦 Artifacts & Distribution

All binaries are self-contained standalone executables with the React single-page frontend embedded directly into the Go binary.

| File | Platform | Architecture | Size |
|---|---|---|---|
| `nexus-linux-amd64` | Linux | x86_64 / amd64 | ~35 MB |
| `nexus-linux-arm64` | Linux | aarch64 / arm64 | ~33 MB |
| `nexus_server.exe` | Windows | x86_64 / amd64 | ~36 MB |

---

## 🛠️ Quick Installation & Upgrade

### Linux (One-line upgrade):
```bash
# Download and replace binary
curl -fsSL -o /usr/local/bin/nexus https://github.com/your-org/nexus/releases/download/v1.1.0/nexus-linux-amd64
chmod +x /usr/local/bin/nexus
systemctl restart nexus
```

### Windows:
Run `nexus_server.exe` as administrator or execute from terminal:
```powershell
.\nexus_server.exe
```
Default panel web UI is served at: `http://127.0.0.1:8443` (or configured port).

---

## 📝 Commits Included in this Release
- `b67a827` — fix: resolve toast spamming loop with deduplication, single notification guard, and responsive SVG canvas
- `a491c38` — feat: implement luxury Premium Black theme with architectural background geometry and Nexus monogram insignia
- `f4ccd06` — style: lighten dark theme canvas and elevate card surfaces for optimal contrast
- `aef9ca5` — refactor: executive dark minimalist design and unified background
- `63bfd19` — style: apply unified full-window cyberpunk background with frosted glassmorphism across sidebar, header and cards
- `0a7368c` — style: atmospheric cyber background and signature holographic NEXUS emblem typography
- `23bdd91` — feat: implement Next-generation interactive toast notification and header notification center system
- `0f927f7` — fix(ui): eliminate chart overlap with footer, fix canvas clipping and peak speed tracking
- `511d95a` — feat: modern reactive React SPA dashboard with Exon dark theme, hardware telemetry, and updates modal
