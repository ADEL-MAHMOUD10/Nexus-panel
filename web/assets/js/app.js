// Nexus Core Panel Reactive Application (Alpine.js State Engine)
document.addEventListener('alpine:init', () => {
  Alpine.data('nexusApp', () => ({
    token: localStorage.getItem('nexus_token') || '',
    activeTab: 'overview',
    
    // Auth Form
    loginUsername: '',
    loginPassword: '',

    // Rich Telemetry & System State
    status: {
      xrayRunning: false,
      xrayVersion: 'v26.9.30',
      serverTime: 0,
      cpu: {
        usedPercent: 0,
        cores: 2,
        freqGHz: 3.00,
        model: 'Standard Processor',
        avg: 0,
        peak: 0,
        history: [0.5, 0.7, 1.2, 0.8, 0.6, 0.9, 0.7, 1.1, 0.7, 0.8, 0.6, 0.7]
      },
      mem: {
        usedPercent: 0,
        used: 0,
        total: 0,
        free: 0,
        avg: 0,
        peak: 0,
        history: [22.4, 22.5, 22.6, 22.5, 22.6, 22.7, 22.6, 22.6]
      },
      swap: {
        usedPercent: 0,
        used: 0,
        total: 0,
        history: [0, 0, 0, 0, 0, 0]
      },
      disk: {
        usedPercent: 0,
        used: 0,
        total: 0,
        free: 0
      },
      net: {
        bytesSent: 0,
        bytesRecv: 0,
        speedUp: 0,
        speedDown: 0,
        peakSpeed: 0,
        historyUp: [25, 30, 45, 60, 38, 42, 50, 37, 45, 38, 40],
        historyDown: [30, 45, 80, 110, 55, 48, 65, 52, 40, 38, 42]
      },
      sockets: {
        total: 0,
        tcp: 0,
        udp: 0,
        history: [150, 155, 168, 172, 176, 174, 176, 175, 176]
      },
      uptime: {
        os: 0,
        xray: 0
      },
      panel: {
        memMB: 0,
        threads: 0
      },
      os: 'Linux Core',
      publicIP: ''
    },

    // Inbounds & Clients
    inbounds: [],
    inboundSearch: '',
    inboundProtocolFilter: 'all', // 'all', 'vless', 'trojan', 'vmess', 'shadowsocks'
    inboundSortBy: 'oldest',      // 'oldest', 'newest', 'port_asc', 'port_desc', 'traffic'
    isEditingInbound: false,
    editingInboundId: 0,
    clientSearch: '',
    clientStatusFilter: 'all', // 'all', 'online', 'active', 'depleting', 'disabled', 'ended'
    clientSortBy: 'oldest',    // 'oldest', 'newest', 'traffic', 'remaining'
    clientFilterOpen: false,
    clientFilterInbound: 'all',
    clientSpeeds: {},
    clientPreviousStats: {},
    selectedClientIds: [],
    clientDetailModalOpen: false,
    selectedClientDetail: null,
    isEditingClient: false,

    // Updates State & Modal
    updatesModalOpen: false,
    isCheckingUpdates: false,
    isUpdatingXray: false,
    isUpdatingPanel: false,
    updates: {
      panel: {
        currentVersion: '',
        latestVersion: '',
        hasUpdate: false,
        updateUrl: 'https://github.com/ADEL-MAHMOUD10/Nexus-panel/releases'
      },
      xray: {
        currentVersion: '',
        latestVersion: '',
        hasUpdate: false,
        updateUrl: 'https://github.com/XTLS/Xray-core/releases'
      }
    },

    // Modals
    inboundModalOpen: false,
    clientModalOpen: false,
    qrModalOpen: false,
    serverCertificates: [],
    isFetchingCert: false,
    isIssuingCert: false,
    logsModalOpen: false,
    configModalOpen: false,

    // Inbound Form with Tabbed Architecture
    inboundModalTab: 'basics', // 'basics' | 'protocol' | 'stream' | 'security' | 'sniffing' | 'advanced'
    inboundForm: {
      // Basics
      remark: '',
      port: 443,
      listen: '0.0.0.0',
      totalGB: 0,
      expiryDays: 0,

      // Protocol
      protocol: 'vless',
      vlessDecryption: 'none',
      vlessFlow: 'xtls-rprx-vision',
      vmessSecurity: 'auto',
      vmessAlterId: 0,
      shadowsocksMethod: '2022-blake3-aes-128-gcm',
      shadowsocksPassword: '',

      // Stream / Transport
      network: 'tcp',
      tcpHeaderType: 'none',
      tcpHost: '',
      tcpPath: '/',
      wsPath: '/vless-ws',
      wsHost: '',
      httpupgradePath: '/vless-httpupgrade',
      httpupgradeHost: '',
      grpcServiceName: 'vless-grpc',
      grpcMultiMode: false,
      xhttpPath: '/vless-xhttp',
      xhttpMode: 'auto',

      // Security
      security: 'tls', // 'none' | 'tls' | 'reality'
      // TLS Settings
      tlsSNI: '',
      tlsALPN: 'h2,http/1.1',
      tlsMinVersion: '1.2',
      tlsMaxVersion: '1.3',
      tlsCertMode: 'file', // 'file' | 'content'
      tlsCertFile: '',
      tlsKeyFile: '',
      tlsCertPem: '',
      tlsKeyPem: '',
      tlsRejectUnknownSni: false,
      tlsFingerprint: 'chrome',

      // REALITY Settings
      realityDest: 'www.google.com:443',
      realityServerNames: 'www.google.com',
      realityPrivKey: '',
      realityPubKey: '',
      realityShortId: '',
      realitySpiderX: '/',
      realityFingerprint: 'chrome',
      realityShow: false,

      // Sniffing
      sniffingEnabled: true,
      sniffingDestOverride: ['http', 'tls', 'quic', 'fakedns'],
      sniffingMetadataOnly: false,
      sniffingRouteOnly: false,

      // Advanced
      sockoptTcpFastOpen: false,
      sockoptTproxy: 'off',
      sockoptMark: 0,
      fallbacksDest: '',
      fallbacksPath: ''
    },

    // Realtime Port Conflict Detection (for live form feedback)
    get portConflict() {
      const port = parseInt(this.inboundForm.port);
      if (!port || port <= 0 || port > 65535) return null;

      const listen = (this.inboundForm.listen || '0.0.0.0').trim();
      const net = this.inboundForm.network;
      const isTargetUDP = (this.inboundForm.protocol === 'hysteria' || this.inboundForm.protocol === 'tuic' || net === 'kcp' || net === 'quic');

      const found = this.inbounds.find(existing => {
        // When editing an inbound, ignore conflict with self
        if (this.isEditingInbound && existing.id === this.editingInboundId) return false;

        if (existing.port !== port) return false;

        let existingIsUDP = false;
        if (existing.protocol === 'hysteria' || existing.protocol === 'tuic') {
          existingIsUDP = true;
        } else {
          try {
            const ss = JSON.parse(existing.streamSettings || '{}');
            if (ss.network === 'kcp' || ss.network === 'quic') existingIsUDP = true;
          } catch(e){}
        }

        if (isTargetUDP !== existingIsUDP) return false;

        const exListen = (existing.listen || '0.0.0.0').trim();
        return (listen === '0.0.0.0' || exListen === '0.0.0.0' || listen === exListen);
      });

      if (!found) return null;
      return {
        port,
        name: found.remark || found.tag || `Inbound #${found.id}`,
        protocol: (found.protocol || 'VLESS').toUpperCase(),
        listen: found.listen || '0.0.0.0',
        id: found.id
      };
    },

    // Client Form
    clientForm: {
      id: 0,
      inboundId: 0,
      protocol: 'vless',
      security: 'reality',
      email: '',
      credVal: '',
      flow: 'xtls-rprx-vision',
      quotaGB: 0,
      expiryDays: 0,
      enable: true
    },

    // QR & Share
    qrTitle: '',
    qrLinkText: '',

    // Raw Config & Logs
    rawConfigText: '',
    logsList: [],
    logsRows: '20',
    logsLevel: 'info',
    logsSyslog: false,
    logsAutoUpdate: false,
    logsLoading: false,
    logsTimer: null,
    ipMasked: true,

    // Custom Confirmation Dialog (Replaces native browser confirm)
    confirmDialog: {
      open: false,
      title: 'Confirmation Required',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      isDanger: false,
      _resolve: null
    },

    askConfirm(message, { title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false } = {}) {
      return new Promise((resolve) => {
        this.confirmDialog = {
          open: true,
          title,
          message,
          confirmText,
          cancelText,
          isDanger: !!isDanger,
          _resolve: resolve
        };
      });
    },

    resolveConfirm(choice) {
      if (this.confirmDialog._resolve) {
        this.confirmDialog._resolve(choice);
        this.confirmDialog._resolve = null;
      }
      this.confirmDialog.open = false;
    },

    // Toast
    toast: {
      show: false,
      msg: '',
      isSuccess: true
    },

    routeTo(path, pushState = true) {
      if (!path) path = '/panel';
      const cleanPath = path.toLowerCase().replace(/\/+$/, '');
      if (pushState && window.location.pathname !== path) {
        history.pushState(null, '', path);
      }
      if (cleanPath.endsWith('/logs')) {
        this.openLogs(false);
      } else if (cleanPath.endsWith('/config')) {
        this.openConfig(false);
      } else if (cleanPath.endsWith('/inbounds')) {
        this.activeTab = 'inbounds';
        this.logsModalOpen = false;
        this.configModalOpen = false;
      } else if (cleanPath.endsWith('/clients')) {
        this.activeTab = 'clients';
        this.logsModalOpen = false;
        this.configModalOpen = false;
      } else {
        this.activeTab = 'overview';
        this.logsModalOpen = false;
        this.configModalOpen = false;
      }
    },

    navigateTab(tab) {
      this.activeTab = tab;
      const targetPath = tab === 'overview' ? '/panel' : `/panel/${tab}`;
      if (window.location.pathname !== targetPath) {
        history.pushState(null, '', targetPath);
      }
    },

    init() {
      window.addEventListener('popstate', () => {
        this.routeTo(window.location.pathname, false);
      });
      if (this.token) {
        this.routeTo(window.location.pathname, false);
        this.refreshData();
        this.checkUpdates();
        setInterval(() => {
          if (this.token) {
            if (this.activeTab === 'overview') {
              this.fetchServerStatus();
            } else if (this.activeTab === 'clients' || this.activeTab === 'inbounds') {
              this.refreshData();
            }
          }
        }, 2500);
      }
    },

    showToast(msg, isSuccess = true) {
      this.toast.msg = msg;
      this.toast.isSuccess = isSuccess;
      this.toast.show = true;
      setTimeout(() => { this.toast.show = false; }, 3200);
    },

    async copy(text) {
      if (!text) return;
      let copied = false;

      // 1. Try modern Async Clipboard API (works on HTTPS & localhost)
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (e) {
          copied = false;
        }
      }

      // 2. Fallback for insecure contexts (HTTP domains like http://nexus.sigmacode.online:8443/)
      if (!copied) {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.setAttribute('readonly', '');
          textArea.style.position = 'fixed';
          textArea.style.top = '-9999px';
          textArea.style.left = '-9999px';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          textArea.setSelectionRange(0, 99999);
          copied = document.execCommand('copy');
          document.body.removeChild(textArea);
        } catch (err) {
          copied = false;
        }
      }

      if (copied) {
        this.showToast('Copied to clipboard');
      } else {
        // Fallback prompt if clipboard access is completely blocked
        window.prompt('Copy to clipboard (Ctrl+C, Enter):', text);
      }
    },

    toggleIPVisibility() {
      this.ipMasked = !this.ipMasked;
    },

    async api(url, method = 'GET', body = null) {
      const opts = {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      };
      if (body) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(url, opts);
        if (res.status === 401) {
          this.logout();
          return null;
        }
        return await res.json();
      } catch (err) {
        return null;
      }
    },

    async login() {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.loginUsername,
            password: this.loginPassword
          })
        });
        if (res.ok) {
          const data = await res.json();
          this.token = data.token;
          localStorage.setItem('nexus_token', this.token);
          this.refreshData();
        } else {
          this.showToast('Invalid credentials', false);
        }
      } catch (err) {
        this.showToast('Login connection failed', false);
      }
    },

    logout() {
      fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('nexus_token');
      this.token = '';
    },

    async fetchServerStatus() {
      const st = await this.api('/api/server/status');
      if (!st) return;

      const cpuVal = Math.round((st.cpu?.usedPercent || 0) * 10) / 10;
      const memVal = Math.round((st.mem?.usedPercent || 0) * 10) / 10;
      const swapVal = Math.round((st.swap?.usedPercent || 0) * 10) / 10;
      const diskVal = Math.round((st.disk?.usedPercent || 0) * 10) / 10;

      // Update history arrays
      this.updateHistory(this.status.cpu.history, cpuVal, 16);
      this.updateHistory(this.status.mem.history, memVal, 16);
      this.updateHistory(this.status.swap.history, swapVal, 16);

      const speedUpKB = Math.round((st.net?.speedUp || 0) / 1024 * 10) / 10;
      const speedDownKB = Math.round((st.net?.speedDown || 0) / 1024 * 10) / 10;
      this.updateHistory(this.status.net.historyUp, speedUpKB, 24);
      this.updateHistory(this.status.net.historyDown, speedDownKB, 24);

      const maxSpeedNow = Math.max(speedUpKB, speedDownKB);
      if (maxSpeedNow > this.status.net.peakSpeed) {
        this.status.net.peakSpeed = maxSpeedNow;
      }

      const totalSockets = st.sockets?.total || 0;
      this.updateHistory(this.status.sockets.history, totalSockets, 20);

      this.status = {
        xrayRunning: !!st.xrayRunning,
        xrayVersion: st.xrayVersion || 'v26.9.30',
        serverTime: st.serverTime || Date.now(),
        cpu: {
          usedPercent: cpuVal,
          cores: st.cpu?.cores || 6,
          threads: st.cpu?.threads || st.cpu?.cores || 12,
          freqGHz: st.cpu?.freqGHz ? (Math.round(st.cpu.freqGHz * 100) / 100).toFixed(2) : '2.30',
          model: st.cpu?.model || 'Standard Processor',
          avg: this.calcAvg(this.status.cpu.history),
          peak: Math.max(...this.status.cpu.history),
          history: this.status.cpu.history
        },
        mem: {
          usedPercent: memVal,
          used: st.mem?.used || 0,
          total: st.mem?.total || 0,
          available: st.mem?.available || Math.max(0, (st.mem?.total || 0) - (st.mem?.used || 0)),
          free: st.mem?.free || 0,
          buffers: st.mem?.buffers || 0,
          cached: st.mem?.cached || 0,
          type: st.mem?.type || 'DDR4',
          speedMHz: st.mem?.speedMHz || 3200,
          display: st.mem?.display || 'DDR4 @ 3200 MHz',
          avg: this.calcAvg(this.status.mem.history),
          peak: Math.max(...this.status.mem.history),
          history: this.status.mem.history
        },
        swap: {
          usedPercent: swapVal,
          used: st.swap?.used || 0,
          total: st.swap?.total || 0,
          history: this.status.swap.history
        },
        disk: {
          usedPercent: diskVal,
          used: st.disk?.used || 0,
          total: st.disk?.total || 0,
          free: st.disk?.free || 0
        },
        net: {
          bytesSent: st.net?.bytesSent || 0,
          bytesRecv: st.net?.bytesRecv || 0,
          speedUp: st.net?.speedUp || 0,
          speedDown: st.net?.speedDown || 0,
          peakSpeed: this.status.net.peakSpeed,
          historyUp: this.status.net.historyUp,
          historyDown: this.status.net.historyDown
        },
        sockets: {
          total: totalSockets,
          tcp: st.sockets?.tcp || 0,
          udp: st.sockets?.udp || 0,
          history: this.status.sockets.history
        },
        uptime: {
          os: this.formatUptime(st.uptime?.os || 0),
          xray: this.formatUptime(st.uptime?.xray || 0)
        },
        panel: {
          memMB: Math.round((st.panel?.memMB || 0) * 10) / 10,
          threads: st.panel?.threads || 19
        },
        os: st.os || 'Linux Core',
        publicIP: st.publicIP || ''
      };

      if (st.panelVersion) {
        this.updates.panel.currentVersion = st.panelVersion;
      }
      if (st.xrayVersion) {
        this.status.xrayVersion = st.xrayVersion;
        this.updates.xray.currentVersion = st.xrayVersion;
      }
    },

    updateHistory(arr, val, maxLen = 16) {
      arr.push(val);
      if (arr.length > maxLen) {
        arr.shift();
      }
    },

    calcAvg(arr) {
      if (!arr || arr.length === 0) return 0;
      const sum = arr.reduce((acc, v) => acc + v, 0);
      return Math.round((sum / arr.length) * 10) / 10;
    },

    async refreshData() {
      await this.fetchServerStatus();
      const inbRes = await this.api('/api/inbounds/list');
      if (inbRes && inbRes.inbounds) {
        this.inbounds = inbRes.inbounds;
        this.updateClientSpeeds();
      }
    },

    updateClientSpeeds() {
      const now = Date.now();
      this.inbounds.forEach(inb => {
        if (!inb.clients) return;
        inb.clients.forEach(c => {
          const email = c.email;
          if (!email) return;
          const prev = this.clientPreviousStats[email];
          if (prev) {
            const dt = Math.max(1, (now - prev.time) / 1000);
            const deltaUp = Math.max(0, (c.up || 0) - prev.up);
            const deltaDown = Math.max(0, (c.down || 0) - prev.down);
            const upSpeed = deltaUp / dt;
            const downSpeed = deltaDown / dt;
            const hadActivity = (deltaUp > 0 || deltaDown > 0);
            const lastActive = hadActivity ? now : (prev.lastActive || 0);
            this.clientSpeeds[email] = {
              upSpeed,
              downSpeed,
              lastActive
            };
          } else {
            this.clientSpeeds[email] = {
              upSpeed: 0,
              downSpeed: 0,
              lastActive: ((c.up || 0) + (c.down || 0) > 0) ? now : 0
            };
          }
          this.clientPreviousStats[email] = {
            up: c.up || 0,
            down: c.down || 0,
            time: now,
            lastActive: this.clientSpeeds[email]?.lastActive || 0
          };
        });
      });
    },

    getInboundBadgeClass(proto, port) {
      const p = parseInt(port, 10);
      if (p === 2053 || p === 80 || p === 8080) {
        return 'bg-[#341d13] text-[#f97316] border-[#592b15]';
      } else if (p === 2084 || p === 443 || p === 8443 || p === 2083 || p === 2087 || p === 2096) {
        return 'bg-[#10233b] text-[#38bdf8] border-[#1d4272]';
      } else if (proto === 'trojan') {
        return 'bg-[#132a24] text-[#34d399] border-[#1b4d3e]';
      } else {
        return 'bg-[#25153a] text-[#c084fc] border-[#4c1d95]';
      }
    },

    // Core Controls
    async restartXray() {
      const res = await this.api('/api/server/restart-xray', 'POST');
      if (res && res.success) {
        this.showToast('Xray-core restarted');
        this.fetchServerStatus();
      } else {
        this.showToast(res?.message || 'Failed to restart core', false);
      }
    },

    async restartPanel() {
      const ok = await this.askConfirm('Restart Nexus Panel web management service? Dashboard connection will briefly reconnect.', {
        title: 'Restart Nexus Panel',
        confirmText: 'Restart Panel',
        isDanger: true
      });
      if (!ok) return;

      this.showToast('Restarting Nexus Panel service... Reconnecting...');
      try {
        await this.api('/api/server/restart-panel', 'POST');
      } catch(e) {}

      let retries = 0;
      const checkInterval = setInterval(async () => {
        retries++;
        try {
          const res = await fetch('/api/server/status', { credentials: 'same-origin' });
          if (res.ok) {
            clearInterval(checkInterval);
            this.showToast('Nexus Panel reconnected successfully!');
            await this.fetchServerStatus();
          }
        } catch(e) {}

        if (retries > 25) {
          clearInterval(checkInterval);
          window.location.reload();
        }
      }, 1500);
    },

    async stopXray() {
      const ok = await this.askConfirm('Are you sure you want to stop the core proxy kernel? Active proxy connections will be severed.', {
        title: 'Stop Proxy Kernel',
        confirmText: 'Stop Service',
        isDanger: true
      });
      if (!ok) return;
      const res = await this.api('/api/server/stop-xray', 'POST');
      if (res && res.success) {
        this.showToast('Xray-core stopped');
        this.fetchServerStatus();
      }
    },

    async openLogs(updateUrl = true) {
      this.logsModalOpen = true;
      if (updateUrl && !window.location.pathname.endsWith('/logs')) {
        history.pushState(null, '', '/panel/logs');
      }
      await this.refreshLogs();
      if (this.logsAutoUpdate) {
        this.startLogsAutoUpdate();
      }
    },

    closeLogs() {
      this.logsModalOpen = false;
      this.stopLogsAutoUpdate();
      const targetPath = this.activeTab === 'overview' ? '/panel' : `/panel/${this.activeTab}`;
      if (window.location.pathname.endsWith('/logs')) {
        history.pushState(null, '', targetPath);
      }
    },

    startLogsAutoUpdate() {
      this.stopLogsAutoUpdate();
      if (this.logsAutoUpdate && this.logsModalOpen) {
        this.logsTimer = setInterval(() => {
          if (this.logsModalOpen && this.logsAutoUpdate) {
            this.refreshLogs(false);
          } else {
            this.stopLogsAutoUpdate();
          }
        }, 3500);
      }
    },

    stopLogsAutoUpdate() {
      if (this.logsTimer) {
        clearInterval(this.logsTimer);
        this.logsTimer = null;
      }
    },

    toggleLogsAutoUpdate() {
      if (this.logsAutoUpdate) {
        this.startLogsAutoUpdate();
      } else {
        this.stopLogsAutoUpdate();
      }
    },

    async refreshLogs(showSpinner = true) {
      if (showSpinner) this.logsLoading = true;
      try {
        const res = await this.api('/api/server/logs', 'POST', {
          count: parseInt(this.logsRows, 10) || 20,
          level: this.logsLevel || 'info',
          syslog: !!this.logsSyslog
        });
        if (res && res.logs) {
          this.logsList = res.logs;
        }
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      } finally {
        if (showSpinner) {
          setTimeout(() => { this.logsLoading = false; }, 300);
        }
      }
    },

    downloadLogs() {
      if (!this.logsList || this.logsList.length === 0) {
        this.showToast('No logs to download');
        return;
      }
      const content = this.logsList.join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `nexus-${this.logsSyslog ? 'syslog' : 'panel'}-${dateStr}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    parseLogLine(raw) {
      if (!raw) return { stamp: '', date: '', time: '', levelText: '', levelClass: '', service: '', body: '' };
      const line = (raw || '').trim();

      const SYSLOG_PREFIX = /^([A-Za-z]{3}\s+\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+\S+\s+\S+?:\s+(.*)$/;
      const GO_LOG_DATE = /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+/;
      const TELEGO = /^\[[^\]]+\]\s+([A-Z]+)\s+(.*)$/;
      const APP_LOG = /^(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+-\s+([\s\S]*)$/;

      const LEVELS = ['DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR'];

      function splitLevelDash(message) {
        const dash = message.indexOf(' - ');
        if (dash < 0) return null;
        const lvl = message.slice(0, dash).trim();
        if (!LEVELS.includes(lvl)) return null;
        return { level: lvl, rest: message.slice(dash + 3) };
      }

      let date = '';
      let time = '';
      let levelText = '';
      let body = '';

      const sys = line.match(SYSLOG_PREFIX);
      if (sys) {
        date = sys[1];
        time = sys[2];
        let message = sys[3];
        const ld = splitLevelDash(message);
        if (ld) {
          levelText = ld.level;
          body = ld.rest;
        } else {
          message = message.replace(GO_LOG_DATE, '');
          const tg = message.match(TELEGO);
          if (tg && LEVELS.includes(tg[1])) {
            levelText = tg[1];
            body = tg[2];
          } else {
            body = message;
          }
        }
      } else {
        const app = line.match(APP_LOG);
        if (app) {
          date = app[1];
          time = app[2];
          levelText = app[3];
          body = app[4];
        } else {
          body = line;
        }
      }

      let levelClass = 'text-zinc-400';
      const lvlUpper = (levelText || '').toUpperCase();
      if (lvlUpper === 'DEBUG') {
        levelClass = 'text-[#6aa6ee]';
      } else if (lvlUpper === 'INFO') {
        levelClass = 'text-[#4ed3a6]';
      } else if (lvlUpper === 'NOTICE') {
        levelClass = 'text-[#4ed3a6]';
      } else if (lvlUpper === 'WARNING' || lvlUpper === 'WARN') {
        levelClass = 'text-[#ffb872]';
      } else if (lvlUpper === 'ERROR' || lvlUpper === 'ERR') {
        levelClass = 'text-[#ff7575]';
      }

      let service = '';
      if (body.startsWith('XRAY:')) {
        service = 'XRAY:';
        body = body.slice('XRAY:'.length).trimStart();
      } else if (body.startsWith('NEXUS:')) {
        service = 'NEXUS:';
        body = body.slice('NEXUS:'.length).trimStart();
      } else if (body.startsWith('X-UI:')) {
        service = 'X-UI:';
        body = body.slice('X-UI:'.length).trimStart();
      }

      const stamp = [date, time].filter(Boolean).join(' ');
      return { date, time, stamp, levelText, levelClass, service, body };
    },

    get parsedLogs() {
      return (this.logsList || []).map(l => this.parseLogLine(l));
    },

    getParsedLogs() {
      return (this.logsList || []).map(l => this.parseLogLine(l));
    },

    async openConfig(updateUrl = true) {
      this.configModalOpen = true;
      if (updateUrl && !window.location.pathname.endsWith('/config')) {
        history.pushState(null, '', '/panel/config');
      }
      const res = await this.api('/api/server/config');
      if (res && res.config) {
        this.rawConfigText = res.config;
      }
    },

    closeConfig() {
      this.configModalOpen = false;
      const targetPath = this.activeTab === 'overview' ? '/panel' : `/panel/${this.activeTab}`;
      if (window.location.pathname.endsWith('/config')) {
        history.pushState(null, '', targetPath);
      }
    },

    async saveConfig() {
      const res = await this.api('/api/server/config', 'POST', { config: this.rawConfigText });
      if (res && res.success) {
        this.configModalOpen = false;
        this.showToast('Config updated & core reloaded');
        this.fetchServerStatus();
      } else {
        this.showToast(res?.message || 'Failed to update config', false);
      }
    },

    // Computeds
    get totalClients() {
      let count = 0;
      this.inbounds.forEach(inb => {
        if (inb.clients) count += inb.clients.length;
      });
      return count;
    },

    get totalUpload() {
      let up = 0;
      this.inbounds.forEach(inb => {
        up += inb.up || 0;
        if (inb.clients) {
          inb.clients.forEach(c => up += c.up || 0);
        }
      });
      return this.formatBytes(up);
    },

    get totalDownload() {
      let down = 0;
      this.inbounds.forEach(inb => {
        down += inb.down || 0;
        if (inb.clients) {
          inb.clients.forEach(c => down += c.down || 0);
        }
      });
      return this.formatBytes(down);
    },

    get inboundStats() {
      const all = this.inbounds;
      let enabled = 0, disabled = 0, totalUp = 0, totalDown = 0, totalClients = 0;
      all.forEach(i => {
        if (i.enable) enabled++; else disabled++;
        totalUp += (i.up || 0);
        totalDown += (i.down || 0);
        if (i.clients) {
          totalClients += i.clients.length;
          i.clients.forEach(c => {
            totalUp += (c.up || 0);
            totalDown += (c.down || 0);
          });
        }
      });

      return {
        total: all.length,
        enabled,
        disabled,
        totalUp: this.formatBytes(totalUp),
        totalDown: this.formatBytes(totalDown),
        totalTraffic: this.formatBytes(totalUp + totalDown),
        totalClients
      };
    },

    get filteredInbounds() {
      let list = [...this.inbounds];

      if (this.inboundProtocolFilter && this.inboundProtocolFilter !== 'all') {
        list = list.filter(i => (i.protocol || '').toLowerCase() === this.inboundProtocolFilter.toLowerCase());
      }

      if (this.inboundSearch) {
        const q = this.inboundSearch.toLowerCase().trim();
        list = list.filter(i => {
          const remark = (i.remark || '').toLowerCase();
          const tag = (i.tag || '').toLowerCase();
          const port = String(i.port);
          const listen = (i.listen || '').toLowerCase();
          const proto = (i.protocol || '').toLowerCase();
          
          let streamSni = '';
          let streamPath = '';
          try {
            const ss = JSON.parse(i.streamSettings || '{}');
            if (ss.tlsSettings?.serverName) streamSni = ss.tlsSettings.serverName.toLowerCase();
            if (ss.realitySettings?.dest) streamSni += ' ' + ss.realitySettings.dest.toLowerCase();
            if (ss.wsSettings?.path) streamPath = ss.wsSettings.path.toLowerCase();
          } catch(e) {}

          return remark.includes(q) || tag.includes(q) || port.includes(q) || listen.includes(q) || proto.includes(q) || streamSni.includes(q) || streamPath.includes(q);
        });
      }

      if (this.inboundSortBy === 'oldest') {
        list.sort((a, b) => a.id - b.id);
      } else if (this.inboundSortBy === 'newest') {
        list.sort((a, b) => b.id - a.id);
      } else if (this.inboundSortBy === 'port_asc') {
        list.sort((a, b) => a.port - b.port);
      } else if (this.inboundSortBy === 'port_desc') {
        list.sort((a, b) => b.port - a.port);
      } else if (this.inboundSortBy === 'traffic') {
        list.sort((a, b) => ((b.up || 0) + (b.down || 0)) - ((a.up || 0) + (a.down || 0)));
      }

      return list;
    },

    get clientStats() {
      const all = this.rawClientsList;
      const now = Math.floor(Date.now() / 1000);
      let online = 0, ended = 0, depleting = 0, disabled = 0, active = 0;

      all.forEach(c => {
        const isOnline = (c.up || 0) + (c.down || 0) > 0;
        const isEnded = c.expiryTime > 0 && now > c.expiryTime;
        const isDepleted = c.total > 0 && ((c.up || 0) + (c.down || 0)) >= c.total;
        const isDisabled = !c.enable;

        if (isOnline) online++;
        if (isEnded) ended++;
        if (isDepleted) depleting++;
        if (isDisabled) disabled++;
        if (c.enable && !isEnded && !isDepleted) active++;
      });

      return {
        total: all.length,
        online,
        ended,
        depleting,
        disabled,
        active
      };
    },

    get rawClientsList() {
      const list = [];
      const now = Math.floor(Date.now() / 1000);
      this.inbounds.forEach(inb => {
        if (inb.clients) {
          inb.clients.forEach(c => {
            const trafficUsed = (c.up || 0) + (c.down || 0);
            const sp = this.clientSpeeds[c.email] || { upSpeed: 0, downSpeed: 0, lastActive: 0 };
            const upSpeed = sp.upSpeed;
            const downSpeed = sp.downSpeed;
            const hasRecentActivity = sp.lastActive > 0 && (Date.now() - sp.lastActive < 45000);
            const isOnline = c.enable && (upSpeed > 0 || downSpeed > 0 || hasRecentActivity || trafficUsed > 0);
            const isEnded = c.expiryTime > 0 && now > c.expiryTime;
            const isDepleted = c.total > 0 && trafficUsed >= c.total;
            const isDisabled = !c.enable;
            
            // Calculate progress percent
            let trafficPercent = 0;
            if (c.total > 0) {
              trafficPercent = Math.min(100, Math.round((trafficUsed / c.total) * 100));
            }

            // Calculate remaining traffic
            let remainingTraffic = '∞';
            if (c.total > 0) {
              const rem = Math.max(0, c.total - trafficUsed);
              remainingTraffic = this.formatBytes(rem);
            }

            // Calculate duration / expiry
            let durationText = '∞';
            if (c.expiryTime > 0) {
              const diffSec = c.expiryTime - now;
              if (diffSec <= 0) {
                durationText = 'Ended';
              } else {
                const days = Math.floor(diffSec / 86400);
                const hrs = Math.floor((diffSec % 86400) / 3600);
                durationText = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
              }
            }

            list.push({
              ...c,
              inboundRemark: inb.remark || inb.tag,
              inboundPort: inb.port,
              inboundTag: inb.tag,
              inboundProtocol: inb.protocol,
              upSpeed,
              downSpeed,
              isOnline,
              isEnded,
              isDepleted,
              trafficUsed,
              trafficPercent,
              remainingTraffic,
              durationText
            });
          });
        }
      });
      return list;
    },

    get allClients() {
      let list = this.rawClientsList;

      // Filter by status tab
      if (this.clientStatusFilter === 'online') {
        list = list.filter(c => c.isOnline);
      } else if (this.clientStatusFilter === 'ended') {
        list = list.filter(c => c.isEnded);
      } else if (this.clientStatusFilter === 'depleting') {
        list = list.filter(c => c.isDepleted);
      } else if (this.clientStatusFilter === 'disabled') {
        list = list.filter(c => !c.enable);
      } else if (this.clientStatusFilter === 'active') {
        list = list.filter(c => c.enable && !c.isEnded && !c.isDepleted);
      }

      // Filter by inbound if selected
      if (this.clientFilterInbound && this.clientFilterInbound !== 'all') {
        list = list.filter(c => String(c.inboundId) === String(this.clientFilterInbound));
      }

      // Search by email, comment, UUID, subID, port
      if (this.clientSearch) {
        const q = this.clientSearch.toLowerCase().trim();
        list = list.filter(c => 
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.uuid && c.uuid.toLowerCase().includes(q)) ||
          (c.subId && c.subId.toLowerCase().includes(q)) ||
          (c.inboundRemark && c.inboundRemark.toLowerCase().includes(q)) ||
          (c.inboundTag && c.inboundTag.toLowerCase().includes(q)) ||
          String(c.inboundPort).includes(q)
        );
      }

      // Sorting
      if (this.clientSortBy === 'oldest') {
        list.sort((a, b) => a.id - b.id);
      } else if (this.clientSortBy === 'newest') {
        list.sort((a, b) => b.id - a.id);
      } else if (this.clientSortBy === 'traffic') {
        list.sort((a, b) => b.trafficUsed - a.trafficUsed);
      } else if (this.clientSortBy === 'remaining') {
        list.sort((a, b) => (b.total - b.trafficUsed) - (a.total - a.trafficUsed));
      }

      return list;
    },

    toggleSelectAllClients() {
      const currentList = this.allClients;
      if (this.selectedClientIds.length === currentList.length && currentList.length > 0) {
        this.selectedClientIds = [];
      } else {
        this.selectedClientIds = currentList.map(c => c.id);
      }
    },

    isClientSelected(id) {
      return this.selectedClientIds.includes(id);
    },

    toggleClientSelection(id) {
      const idx = this.selectedClientIds.indexOf(id);
      if (idx > -1) {
        this.selectedClientIds.splice(idx, 1);
      } else {
        this.selectedClientIds.push(id);
      }
    },

    async bulkToggleEnable(enable) {
      if (this.selectedClientIds.length === 0) return;
      const actionName = enable ? 'Enable' : 'Disable';
      const ok = await this.askConfirm(`${actionName} ${this.selectedClientIds.length} selected client accounts?`, {
        title: `${actionName} Selected Clients`,
        confirmText: `${actionName} Clients`,
        isDanger: !enable
      });
      if (!ok) return;

      const res = await this.api('/api/clients/bulk', 'POST', {
        action: enable ? 'enable' : 'disable',
        ids: this.selectedClientIds
      });
      if (res && res.success) {
        this.showToast(`${this.selectedClientIds.length} clients ${enable ? 'enabled' : 'disabled'}`);
        this.selectedClientIds = [];
        this.refreshData();
      }
    },

    async bulkResetTraffic() {
      if (this.selectedClientIds.length === 0) return;
      const ok = await this.askConfirm(`Reset traffic counters for ${this.selectedClientIds.length} selected client accounts to 0?`, {
        title: 'Reset Traffic for Selected',
        confirmText: 'Reset Traffic',
        isDanger: true
      });
      if (!ok) return;

      const res = await this.api('/api/clients/bulk', 'POST', {
        action: 'reset-traffic',
        ids: this.selectedClientIds
      });
      if (res && res.success) {
        this.showToast(`Traffic reset for ${this.selectedClientIds.length} clients`);
        this.selectedClientIds = [];
        this.refreshData();
      }
    },

    async bulkDelete() {
      if (this.selectedClientIds.length === 0) return;
      const ok = await this.askConfirm(`Permanently delete ${this.selectedClientIds.length} selected client accounts? This action cannot be undone.`, {
        title: 'Delete Selected Clients',
        confirmText: 'Delete Selected',
        isDanger: true
      });
      if (!ok) return;

      const res = await this.api('/api/clients/bulk', 'POST', {
        action: 'delete',
        ids: this.selectedClientIds
      });
      if (res && res.success) {
        this.showToast(`Deleted ${this.selectedClientIds.length} clients`);
        this.selectedClientIds = [];
        this.refreshData();
      }
    },

    // Updates Checker & Upgrade Methods
    async checkUpdates() {
      this.isCheckingUpdates = true;
      try {
        const res = await this.api('/api/server/check-updates');
        if (res && res.success) {
          this.updates = {
            panel: res.panel,
            xray: res.xray
          };
        }
      } catch (e) {
      } finally {
        this.isCheckingUpdates = false;
      }
    },

    openUpdatesModal() {
      this.updatesModalOpen = true;
      this.checkUpdates();
    },

    async updateXrayNow() {
      const targetVersion = this.updates.xray.latestVersion || 'v26.3.27';
      const ok = await this.askConfirm(`Upgrade Xray Core to ${targetVersion}? The new release binary will be fetched from GitHub and the service will seamlessly reload.`, {
        title: 'Upgrade Xray Kernel',
        confirmText: 'Install Update',
        isDanger: false
      });
      if (!ok) return;

      this.isUpdatingXray = true;
      try {
        const res = await this.api('/api/server/update-xray', 'POST', { version: targetVersion });
        if (res && res.success) {
          this.showToast(res.message || 'Xray core update in progress');
          // Poll after 4 seconds to refresh version
          setTimeout(async () => {
            await this.fetchServerStatus();
            await this.checkUpdates();
            this.isUpdatingXray = false;
            this.showToast('Xray core update completed successfully');
          }, 4500);
        } else {
          this.showToast(res?.message || 'Update failed', false);
          this.isUpdatingXray = false;
        }
      } catch (e) {
        this.showToast('Connection error during core update', false);
        this.isUpdatingXray = false;
      }
    },

    async updatePanelNow() {
      const targetVersion = this.updates.panel.latestVersion || 'latest';
      const ok = await this.askConfirm(`Upgrade Nexus Panel to ${targetVersion}? The new binary will be fetched and installed, then the service will automatically restart.`, {
        title: 'Upgrade Nexus Panel',
        confirmText: 'Start Panel Upgrade',
        isDanger: false
      });
      if (!ok) return;

      this.isUpdatingPanel = true;
      try {
        const res = await this.api('/api/server/update-panel', 'POST');
        if (res && res.success) {
          this.showToast(res.message || 'Panel upgrade initiated. Reconnecting soon...');
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            if (attempts > 3) {
              try {
                const stRes = await fetch('/api/server/status', { credentials: 'same-origin' });
                if (stRes.ok) {
                  clearInterval(poll);
                  this.isUpdatingPanel = false;
                  this.showToast('Nexus Panel upgraded and reloaded successfully!');
                  await this.fetchServerStatus();
                  await this.checkUpdates();
                  setTimeout(() => window.location.reload(), 1200);
                }
              } catch(e) {}
            }
            if (attempts > 35) {
              clearInterval(poll);
              this.isUpdatingPanel = false;
              window.location.reload();
            }
          }, 1500);
        } else {
          this.showToast(res?.message || 'Panel update failed', false);
          this.isUpdatingPanel = false;
        }
      } catch (e) {
        this.showToast('Connection error during panel update', false);
        this.isUpdatingPanel = false;
      }
    },

    // Inbound Actions
    openAddInbound() {
      this.isEditingInbound = false;
      this.editingInboundId = 0;
      this.inboundModalTab = 'basics';
      this.inboundForm.remark = 'VLESS-TLS-' + Math.floor(Math.random() * 900 + 100);

      // Pick an unused port by default to prevent immediate conflict
      const usedPorts = new Set(this.inbounds.map(i => i.port));
      usedPorts.add(8443); // Always exclude web panel port
      const defaultCandidates = [443, 2053, 2083, 2087, 2096, 8080, 8880];
      let selectedPort = defaultCandidates.find(p => !usedPorts.has(p));
      if (!selectedPort) {
        selectedPort = 10000 + Math.floor(Math.random() * 50000);
        while (usedPorts.has(selectedPort)) {
          selectedPort++;
        }
      }

      this.inboundForm.port = selectedPort;
      this.inboundForm.listen = '0.0.0.0';
      this.inboundForm.totalGB = 0;
      this.inboundForm.expiryDays = 0;
      this.inboundForm.protocol = 'vless';
      this.inboundForm.network = 'tcp';
      this.inboundForm.security = 'tls';
      this.inboundModalOpen = true;
      this.generateRealityKeys();
      this.fetchServerCertificates();
    },

    openEditInbound(inb) {
      this.isEditingInbound = true;
      this.editingInboundId = inb.id;
      this.inboundModalTab = 'basics';

      this.inboundForm.remark = inb.remark || inb.tag || '';
      this.inboundForm.port = inb.port;
      this.inboundForm.listen = inb.listen || '0.0.0.0';
      this.inboundForm.totalGB = inb.total > 0 ? (inb.total / (1024 * 1024 * 1024)).toFixed(2) : 0;
      
      if (inb.expiryTime > 0) {
        const diff = inb.expiryTime - Math.floor(Date.now() / 1000);
        this.inboundForm.expiryDays = diff > 0 ? Math.ceil(diff / 86400) : 0;
      } else {
        this.inboundForm.expiryDays = 0;
      }

      this.inboundForm.protocol = inb.protocol || 'vless';

      // Parse Settings
      try {
        const s = typeof inb.settings === 'string' ? JSON.parse(inb.settings || '{}') : (inb.settings || {});
        if (inb.protocol === 'vless') {
          this.inboundForm.vlessDecryption = s.decryption || 'none';
          this.inboundForm.vlessFlow = (s.clients && s.clients[0]?.flow) || 'xtls-rprx-vision';
        } else if (inb.protocol === 'vmess') {
          this.inboundForm.vmessAlterId = s.default?.alterId || 0;
          this.inboundForm.vmessSecurity = s.default?.security || 'auto';
        } else if (inb.protocol === 'shadowsocks') {
          this.inboundForm.shadowsocksMethod = s.method || '2022-blake3-aes-128-gcm';
          this.inboundForm.shadowsocksPassword = s.password || '';
        }
        if (s.fallbacks && s.fallbacks[0]) {
          this.inboundForm.fallbacksDest = s.fallbacks[0].dest || '';
          this.inboundForm.fallbacksPath = s.fallbacks[0].path || '';
        } else {
          this.inboundForm.fallbacksDest = '';
          this.inboundForm.fallbacksPath = '';
        }
      } catch(e) {}

      // Parse StreamSettings
      try {
        const ss = typeof inb.streamSettings === 'string' ? JSON.parse(inb.streamSettings || '{}') : (inb.streamSettings || {});
        this.inboundForm.network = ss.network || 'tcp';
        this.inboundForm.security = ss.security || 'none';

        if (ss.tcpSettings?.header) {
          this.inboundForm.tcpHeaderType = ss.tcpSettings.header.type || 'none';
          if (ss.tcpSettings.header.request) {
            this.inboundForm.tcpHost = (ss.tcpSettings.header.request.headers?.Host?.[0]) || '';
            this.inboundForm.tcpPath = (ss.tcpSettings.header.request.path?.[0]) || '/';
          }
        }
        if (ss.wsSettings) {
          this.inboundForm.wsPath = ss.wsSettings.path || '/vless-ws';
          this.inboundForm.wsHost = ss.wsSettings.headers?.Host || ss.wsSettings.host || '';
        }
        if (ss.httpupgradeSettings) {
          this.inboundForm.httpupgradePath = ss.httpupgradeSettings.path || '/vless-httpupgrade';
          this.inboundForm.httpupgradeHost = ss.httpupgradeSettings.host || '';
        }
        if (ss.grpcSettings) {
          this.inboundForm.grpcServiceName = ss.grpcSettings.serviceName || 'vless-grpc';
          this.inboundForm.grpcMultiMode = !!ss.grpcSettings.multiMode;
        }
        if (ss.xhttpSettings) {
          this.inboundForm.xhttpPath = ss.xhttpSettings.path || '/vless-xhttp';
          this.inboundForm.xhttpMode = ss.xhttpSettings.mode || 'auto';
        }

        if (ss.realitySettings) {
          const r = ss.realitySettings;
          this.inboundForm.realityDest = r.dest || 'www.google.com:443';
          this.inboundForm.realityServerNames = Array.isArray(r.serverNames) ? r.serverNames.join(', ') : (r.serverNames || 'www.google.com');
          this.inboundForm.realityPrivKey = r.privateKey || '';
          this.inboundForm.realityPubKey = r.settings?.publicKey || '';
          this.inboundForm.realityShortId = (Array.isArray(r.shortIds) ? r.shortIds[0] : r.shortIds) || '';
          this.inboundForm.realitySpiderX = r.settings?.spiderX || '/';
          this.inboundForm.realityFingerprint = r.settings?.fingerprint || 'chrome';
          this.inboundForm.realityShow = !!r.show;
        }

        if (ss.tlsSettings) {
          const t = ss.tlsSettings;
          this.inboundForm.tlsSNI = t.serverName || '';
          this.inboundForm.tlsALPN = Array.isArray(t.alpn) ? t.alpn.join(',') : (t.alpn || 'h2,http/1.1');
          this.inboundForm.tlsMinVersion = t.minVersion || '1.2';
          this.inboundForm.tlsMaxVersion = t.maxVersion || '1.3';
          this.inboundForm.tlsRejectUnknownSni = !!t.rejectUnknownSni;
          this.inboundForm.tlsFingerprint = t.settings?.fingerprint || 'chrome';
          if (t.certificates && t.certificates[0]) {
            const cert = t.certificates[0];
            if (cert.certificateFile || cert.keyFile) {
              this.inboundForm.tlsCertMode = 'file';
              this.inboundForm.tlsCertFile = cert.certificateFile || '';
              this.inboundForm.tlsKeyFile = cert.keyFile || '';
            } else if (cert.certificate || cert.key) {
              this.inboundForm.tlsCertMode = 'content';
              this.inboundForm.tlsCertPem = Array.isArray(cert.certificate) ? cert.certificate.join('\n') : (cert.certificate || '');
              this.inboundForm.tlsKeyPem = Array.isArray(cert.key) ? cert.key.join('\n') : (cert.key || '');
            }
          }
        }

        if (ss.sockopt) {
          this.inboundForm.sockoptTcpFastOpen = !!ss.sockopt.tcpFastOpen;
          this.inboundForm.sockoptTproxy = ss.sockopt.tproxy || 'off';
          this.inboundForm.sockoptMark = ss.sockopt.mark || 0;
        }
      } catch(e) {}

      // Parse Sniffing
      try {
        const sn = typeof inb.sniffing === 'string' ? JSON.parse(inb.sniffing || '{}') : (inb.sniffing || {});
        this.inboundForm.sniffingEnabled = sn.enabled !== false;
        this.inboundForm.sniffingDestOverride = sn.destOverride || ['http', 'tls', 'quic', 'fakedns'];
        this.inboundForm.sniffingMetadataOnly = !!sn.metadataOnly;
        this.inboundForm.sniffingRouteOnly = !!sn.routeOnly;
      } catch(e) {}

      this.inboundModalOpen = true;
      this.fetchServerCertificates();
    },

    async toggleInboundEnable(inb) {
      const previous = inb.enable;
      inb.enable = !previous;
      const res = await this.api(`/api/inbounds/toggle/${inb.id}`, 'POST');
      if (res && res.success) {
        this.showToast(`Inbound "${inb.remark || inb.tag}" ${inb.enable ? 'enabled' : 'disabled'}`);
      } else {
        inb.enable = previous;
        this.showToast(res?.message || 'Failed to toggle inbound listener', false);
      }
    },

    async resetInboundTraffic(inb) {
      const ok = await this.askConfirm(`Reset accumulated upload and download traffic statistics for inbound "${inb.remark || inb.tag}" to 0?`, {
        title: 'Reset Inbound Traffic',
        confirmText: 'Reset Counters',
        isDanger: true
      });
      if (!ok) return;

      const res = await this.api(`/api/inbounds/reset-traffic/${inb.id}`, 'POST');
      if (res && res.success) {
        this.showToast(`Traffic counters reset for "${inb.remark || inb.tag}"`);
        this.refreshData();
      } else {
        this.showToast(res?.message || 'Failed to reset inbound traffic', false);
      }
    },

    async cloneInbound(inb) {
      const ok = await this.askConfirm(`Clone inbound listener "${inb.remark || inb.tag}"? A duplicate listener with unique credentials will be created on the next available port.`, {
        title: 'Clone Inbound Listener',
        confirmText: 'Clone Listener',
        isDanger: false
      });
      if (!ok) return;

      const res = await this.api(`/api/inbounds/clone/${inb.id}`, 'POST');
      if (res && res.success) {
        this.showToast(`Inbound cloned successfully on port :${res.inbound?.port || ''}`);
        this.refreshData();
      } else {
        this.showToast(res?.message || 'Failed to clone inbound listener', false);
      }
    },

    showInboundQR(inb) {
      if (!inb.clients || inb.clients.length === 0) {
        this.showToast(`No clients configured for "${inb.remark || inb.tag}". Please add a user client first to generate a connection link.`, false);
        return;
      }
      const client = inb.clients[0];
      const link = client.link;
      if (!link) {
        this.showToast('Could not find connection link for this inbound', false);
        return;
      }
      this.qrTitle = `${inb.remark || inb.tag} (${client.email})`;
      this.qrLinkText = link;
      this.qrModalOpen = true;
      this.$nextTick(() => {
        const container = document.getElementById('qrcodeBox');
        if (container) {
          container.innerHTML = '';
          if (window.QRCode) {
            new QRCode(container, {
              text: link,
              width: 190,
              height: 190,
              colorDark: '#1e2127',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          }
        }
      });
    },

    parseStreamDetails(inb) {
      const res = {
        network: 'tcp',
        security: 'none',
        sni: '',
        path: '',
        flow: ''
      };
      try {
        const ss = typeof inb.streamSettings === 'string' ? JSON.parse(inb.streamSettings || '{}') : (inb.streamSettings || {});
        res.network = ss.network || 'tcp';
        res.security = ss.security || 'none';

        if (ss.security === 'reality' && ss.realitySettings) {
          const r = ss.realitySettings;
          res.sni = Array.isArray(r.serverNames) ? r.serverNames[0] : (r.serverNames || r.dest || '');
        } else if (ss.security === 'tls' && ss.tlsSettings) {
          res.sni = ss.tlsSettings.serverName || '';
        }

        if (ss.network === 'ws' && ss.wsSettings) {
          res.path = ss.wsSettings.path || '';
        } else if (ss.network === 'grpc' && ss.grpcSettings) {
          res.path = ss.grpcSettings.serviceName || '';
        } else if (ss.network === 'httpupgrade' && ss.httpupgradeSettings) {
          res.path = ss.httpupgradeSettings.path || '';
        } else if (ss.network === 'xhttp' && ss.xhttpSettings) {
          res.path = ss.xhttpSettings.path || '';
        }

        const s = typeof inb.settings === 'string' ? JSON.parse(inb.settings || '{}') : (inb.settings || {});
        if (s.clients && s.clients[0]?.flow) {
          res.flow = s.clients[0].flow;
        }
      } catch(e) {}
      return res;
    },

    randomizeShortId() {
      const bytes = new Uint8Array(4);
      window.crypto.getRandomValues(bytes);
      this.inboundForm.realityShortId = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    generateSSPassword() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let res = '';
      for (let i = 0; i < 24; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
      this.inboundForm.shadowsocksPassword = res;
    },

    async generateRealityKeys() {
      const res = await this.api('/api/crypto/reality-keys');
      if (res && res.success) {
        this.inboundForm.realityPrivKey = res.privateKey;
        this.inboundForm.realityPubKey = res.publicKey;
        this.inboundForm.realityShortId = res.shortId;
      }
    },

    // SSL Certificate Management
    async fetchServerCertificates() {
      try {
        const res = await this.api('/api/server/certificates');
        if (res && res.success) {
          this.serverCertificates = res.certificates || [];
        }
      } catch (e) {}
    },

    async autoDetectCert() {
      const domain = (this.inboundForm.tlsSNI || '').trim();
      this.isFetchingCert = true;
      try {
        const res = await this.api('/api/server/get-cert', 'POST', {
          domain,
          readPem: this.inboundForm.tlsCertMode === 'content'
        });
        if (res && res.success) {
          if (res.certFile) this.inboundForm.tlsCertFile = res.certFile;
          if (res.keyFile) this.inboundForm.tlsKeyFile = res.keyFile;
          if (res.certPem && this.inboundForm.tlsCertMode === 'content') this.inboundForm.tlsCertPem = res.certPem;
          if (res.keyPem && this.inboundForm.tlsCertMode === 'content') this.inboundForm.tlsKeyPem = res.keyPem;
          if (!this.inboundForm.tlsSNI && res.domain && res.domain !== 'Panel Default') {
            this.inboundForm.tlsSNI = res.domain;
          }

          if (res.found) {
            this.showToast(`SSL Certificate found & loaded for "${res.domain}"!`);
          } else {
            this.showToast(`Standard paths populated for "${res.domain || 'domain'}"`);
          }
        } else {
          this.showToast(res?.message || 'Could not find certificate on server', false);
        }
        await this.fetchServerCertificates();
      } catch (e) {
        this.showToast('Failed to check server certificates', false);
      } finally {
        this.isFetchingCert = false;
      }
    },

    selectServerCert(cert) {
      if (!cert) return;
      this.inboundForm.tlsCertFile = cert.certFile || '';
      this.inboundForm.tlsKeyFile = cert.keyFile || '';
      if (cert.domain && cert.domain !== 'Panel Default') {
        this.inboundForm.tlsSNI = cert.domain;
      }
      this.showToast(`Loaded certificate paths for ${cert.domain}`);
    },

    async setDefaultPanelCert() {
      this.isFetchingCert = true;
      try {
        const res = await this.api('/api/server/certificates');
        if (res && res.success && res.defaultCert) {
          this.inboundForm.tlsCertFile = res.defaultCert.certFile;
          this.inboundForm.tlsKeyFile = res.defaultCert.keyFile;
          this.showToast('Loaded panel default SSL certificate paths');
        } else {
          const sni = (this.inboundForm.tlsSNI || 'default').trim();
          this.inboundForm.tlsCertFile = `/root/cert/${sni}/fullchain.pem`;
          this.inboundForm.tlsKeyFile = `/root/cert/${sni}/privkey.pem`;
          this.showToast(`Auto-filled standard /root/cert/${sni}/ paths`);
        }
      } catch(e) {
        this.showToast('Could not load default panel certificate', false);
      } finally {
        this.isFetchingCert = false;
      }
    },

    clearCertFiles() {
      this.inboundForm.tlsCertFile = '';
      this.inboundForm.tlsKeyFile = '';
      this.inboundForm.tlsCertPem = '';
      this.inboundForm.tlsKeyPem = '';
      this.showToast('Certificate fields cleared');
    },

    async issueSslCertificate() {
      let domain = (this.inboundForm.tlsSNI || '').trim();
      if (!domain) {
        domain = window.prompt('Enter domain name for Let\'s Encrypt SSL (must point to this VPS IP):');
        if (!domain) return;
        domain = domain.trim();
        this.inboundForm.tlsSNI = domain;
      }

      const ok = await this.askConfirm(`Request and issue a Let's Encrypt SSL certificate for "${domain}" using standalone HTTP port 80? Ensure your domain DNS A-record points to this server IP and port 80 is open.`, {
        title: 'Issue SSL Certificate',
        confirmText: 'Issue Certificate',
        isDanger: false
      });
      if (!ok) return;

      this.isIssuingCert = true;
      this.showToast(`Issuing SSL certificate for ${domain}... Please wait.`);
      try {
        const res = await this.api('/api/server/issue-cert', 'POST', { domain });
        if (res && res.success) {
          this.inboundForm.tlsCertFile = res.certFile;
          this.inboundForm.tlsKeyFile = res.keyFile;
          if (res.certPem && this.inboundForm.tlsCertMode === 'content') {
            this.inboundForm.tlsCertPem = res.certPem;
            this.inboundForm.tlsKeyPem = res.keyPem;
          }
          this.showToast(`SSL Certificate issued successfully for ${domain}!`);
          await this.fetchServerCertificates();
        } else {
          this.showToast(res?.message || 'SSL Certificate issuance failed', false);
        }
      } catch (e) {
        this.showToast('Failed to execute SSL issuance', false);
      } finally {
        this.isIssuingCert = false;
      }
    },

    async saveInbound() {
      const port = parseInt(this.inboundForm.port);
      if (!port || port <= 0 || port > 65535) {
        this.showToast('Please enter a valid port between 1 and 65535', false);
        return;
      }

      const listen = (this.inboundForm.listen || '0.0.0.0').trim();
      const net = this.inboundForm.network;
      const isTargetUDP = (this.inboundForm.protocol === 'hysteria' || this.inboundForm.protocol === 'tuic' || net === 'kcp' || net === 'quic');

      // Check conflict locally across active inbounds list (skip self when editing)
      const conflict = this.inbounds.find(existing => {
        if (this.isEditingInbound && existing.id === this.editingInboundId) return false;
        if (existing.port !== port) return false;
        
        let existingIsUDP = false;
        if (existing.protocol === 'hysteria' || existing.protocol === 'tuic') {
          existingIsUDP = true;
        } else {
          try {
            const ss = JSON.parse(existing.streamSettings || '{}');
            if (ss.network === 'kcp' || ss.network === 'quic') existingIsUDP = true;
          } catch(e){}
        }

        // Must share transport (both UDP or both TCP)
        if (isTargetUDP !== existingIsUDP) return false;

        const exListen = (existing.listen || '0.0.0.0').trim();
        return (listen === '0.0.0.0' || exListen === '0.0.0.0' || listen === exListen);
      });

      if (conflict) {
        const name = conflict.remark || conflict.tag || `Inbound #${conflict.id}`;
        this.showToast(`Port ${port} is already in use by "${name}". Duplicate ports on the same protocol are not allowed.`, false);
        return;
      }

      const sec = this.inboundForm.security;
      const streamSettings = { network: net, security: sec };

      // Transmission Network parameters
      if (net === 'tcp') {
        const tcpObj = { header: { type: this.inboundForm.tcpHeaderType || 'none' } };
        if (this.inboundForm.tcpHeaderType === 'http') {
          tcpObj.header.request = {
            version: '1.1',
            method: 'GET',
            path: [(this.inboundForm.tcpPath || '/')],
            headers: {
              Host: this.inboundForm.tcpHost ? [this.inboundForm.tcpHost] : ['www.cloudflare.com']
            }
          };
        }
        streamSettings.tcpSettings = tcpObj;
      } else if (net === 'ws') {
        streamSettings.wsSettings = {
          path: this.inboundForm.wsPath || '/vless-ws',
          headers: { Host: this.inboundForm.wsHost || '' }
        };
      } else if (net === 'httpupgrade') {
        streamSettings.httpupgradeSettings = {
          path: this.inboundForm.httpupgradePath || '/vless-httpupgrade',
          host: this.inboundForm.httpupgradeHost || ''
        };
      } else if (net === 'grpc') {
        streamSettings.grpcSettings = {
          serviceName: this.inboundForm.grpcServiceName || 'vless-grpc',
          multiMode: !!this.inboundForm.grpcMultiMode
        };
      } else if (net === 'xhttp') {
        streamSettings.xhttpSettings = {
          path: this.inboundForm.xhttpPath || '/vless-xhttp',
          mode: this.inboundForm.xhttpMode || 'auto'
        };
      }

      // Security Settings (TLS & REALITY)
      if (sec === 'reality') {
        const serverNames = (this.inboundForm.realityServerNames || 'www.google.com').split(',').map(s => s.trim()).filter(Boolean);
        streamSettings.realitySettings = {
          show: !!this.inboundForm.realityShow,
          xver: 0,
          dest: this.inboundForm.realityDest || 'www.google.com:443',
          serverNames,
          privateKey: this.inboundForm.realityPrivKey,
          shortIds: [this.inboundForm.realityShortId || ''],
          settings: {
            publicKey: this.inboundForm.realityPubKey,
            fingerprint: this.inboundForm.realityFingerprint || 'chrome',
            serverName: '',
            spiderX: this.inboundForm.realitySpiderX || '/'
          }
        };
      } else if (sec === 'tls') {
        const alpn = (this.inboundForm.tlsALPN || 'h2,http/1.1').split(',').map(s => s.trim()).filter(Boolean);
        const certs = [];
        if (this.inboundForm.tlsCertMode === 'file') {
          if (this.inboundForm.tlsCertFile || this.inboundForm.tlsKeyFile) {
            certs.push({
              certificateFile: this.inboundForm.tlsCertFile,
              keyFile: this.inboundForm.tlsKeyFile
            });
          }
        } else {
          if (this.inboundForm.tlsCertPem || this.inboundForm.tlsKeyPem) {
            certs.push({
              certificate: this.inboundForm.tlsCertPem ? this.inboundForm.tlsCertPem.split('\n') : [],
              key: this.inboundForm.tlsKeyPem ? this.inboundForm.tlsKeyPem.split('\n') : []
            });
          }
        }
        streamSettings.tlsSettings = {
          serverName: this.inboundForm.tlsSNI || '',
          alpn,
          minVersion: this.inboundForm.tlsMinVersion || '1.2',
          maxVersion: this.inboundForm.tlsMaxVersion || '1.3',
          rejectUnknownSni: !!this.inboundForm.tlsRejectUnknownSni,
          certificates: certs,
          settings: { fingerprint: this.inboundForm.tlsFingerprint || 'chrome' }
        };
      }

      // Sockopt
      if (this.inboundForm.sockoptTcpFastOpen || this.inboundForm.sockoptTproxy !== 'off' || this.inboundForm.sockoptMark > 0) {
        streamSettings.sockopt = {
          tcpFastOpen: !!this.inboundForm.sockoptTcpFastOpen,
          tproxy: this.inboundForm.sockoptTproxy || 'off',
          mark: parseInt(this.inboundForm.sockoptMark) || 0
        };
      }

      // Sniffing
      const sniffingObj = {
        enabled: !!this.inboundForm.sniffingEnabled,
        destOverride: this.inboundForm.sniffingDestOverride || ['http', 'tls', 'quic', 'fakedns'],
        metadataOnly: !!this.inboundForm.sniffingMetadataOnly,
        routeOnly: !!this.inboundForm.sniffingRouteOnly
      };

      // Protocol-specific settings
      let protocolSettings = { clients: [], decryption: 'none', fallbacks: [] };
      if (this.inboundForm.protocol === 'trojan') {
        protocolSettings = { clients: [], fallbacks: [] };
      } else if (this.inboundForm.protocol === 'shadowsocks') {
        protocolSettings = {
          method: this.inboundForm.shadowsocksMethod || '2022-blake3-aes-128-gcm',
          password: this.inboundForm.shadowsocksPassword || 'secret',
          network: 'tcp,udp'
        };
      } else if (this.inboundForm.protocol === 'vmess') {
        protocolSettings = { clients: [], default: { alterId: parseInt(this.inboundForm.vmessAlterId) || 0 } };
      }

      if (this.inboundForm.fallbacksDest) {
        protocolSettings.fallbacks = [{
          path: this.inboundForm.fallbacksPath || '',
          dest: this.inboundForm.fallbacksDest,
          xver: 0
        }];
      }

      const totalGB = parseFloat(this.inboundForm.totalGB) || 0;
      const totalBytes = totalGB > 0 ? Math.floor(totalGB * 1024 * 1024 * 1024) : 0;
      const expiryDays = parseInt(this.inboundForm.expiryDays) || 0;
      const expiryTime = expiryDays > 0 ? Math.floor(Date.now() / 1000) + (expiryDays * 86400) : 0;

      const payload = {
        port: parseInt(this.inboundForm.port),
        protocol: this.inboundForm.protocol,
        remark: this.inboundForm.remark,
        tag: `in-${this.inboundForm.port}`,
        listen: this.inboundForm.listen || '0.0.0.0',
        total: totalBytes,
        expiryTime: expiryTime,
        settings: JSON.stringify(protocolSettings),
        streamSettings: JSON.stringify(streamSettings),
        sniffing: JSON.stringify(sniffingObj)
      };

      let endpoint = '/api/inbounds/create';
      if (this.isEditingInbound) {
        payload.id = this.editingInboundId;
        endpoint = `/api/inbounds/update/${this.editingInboundId}`;
      }

      const res = await this.api(endpoint, 'POST', payload);
      if (res && res.success) {
        this.inboundModalOpen = false;
        this.showToast(this.isEditingInbound ? 'Inbound listener updated' : 'Inbound listener configured');
        this.isEditingInbound = false;
        this.editingInboundId = 0;
        this.refreshData();
      } else {
        this.showToast(res?.message || 'Failed to save inbound listener', false);
      }
    },

    async deleteInbound(id) {
      const ok = await this.askConfirm('Are you sure you want to remove this inbound listener? All associated client routes will be deactivated.', {
        title: 'Delete Inbound Listener',
        confirmText: 'Delete Listener',
        isDanger: true
      });
      if (!ok) return;
      const res = await this.api('/api/inbounds/delete', 'POST', { id });
      if (res && res.success) {
        this.showToast('Inbound removed');
        this.refreshData();
      }
    },

    // Client Actions
    openAddClient(inbound = null) {
      this.isEditingClient = false;
      const targetInbound = inbound || this.inbounds[0];
      if (!targetInbound) {
        this.showToast('Please create an inbound listener first', false);
        return;
      }

      let sec = 'none';
      try {
        const s = JSON.parse(targetInbound.streamSettings || '{}');
        sec = s.security || 'none';
      } catch(e){}

      const defaultCred = (targetInbound.protocol === 'vless' || targetInbound.protocol === 'vmess')
        ? (crypto?.randomUUID ? crypto.randomUUID() : 'b831381d-6324-4d53-ad4f-8cda48b30811')
        : Math.random().toString(36).slice(2, 10);

      this.clientForm = {
        id: 0,
        inboundId: targetInbound.id,
        protocol: targetInbound.protocol,
        security: sec,
        email: 'user_' + Math.floor(Math.random() * 9000 + 1000),
        credVal: defaultCred,
        flow: (targetInbound.protocol === 'vless' && (sec === 'reality' || sec === 'tls')) ? 'xtls-rprx-vision' : '',
        quotaGB: 0,
        expiryDays: 0,
        enable: true
      };
      this.clientModalOpen = true;
    },

    editClient(c) {
      this.isEditingClient = true;
      const quotaGB = c.total > 0 ? (c.total / (1024 * 1024 * 1024)).toFixed(1) : 0;
      let expiryDays = 0;
      if (c.expiryTime > 0) {
        const diff = c.expiryTime - Math.floor(Date.now() / 1000);
        if (diff > 0) expiryDays = Math.ceil(diff / 86400);
      }

      this.clientForm = {
        id: c.id,
        inboundId: c.inboundId,
        protocol: c.inboundProtocol || 'vless',
        security: 'tls',
        email: c.email,
        credVal: c.uuid || c.password || '',
        flow: c.flow || '',
        quotaGB: quotaGB,
        expiryDays: expiryDays,
        enable: c.enable
      };
      this.clientModalOpen = true;
    },

    openClientInfo(c) {
      this.selectedClientDetail = c;
      this.clientDetailModalOpen = true;
    },

    async toggleClientEnable(c) {
      const payload = {
        id: c.id,
        inboundId: c.inboundId,
        email: c.email,
        uuid: c.uuid,
        password: c.password,
        flow: c.flow,
        total: c.total,
        expiryTime: c.expiryTime,
        enable: !c.enable
      };
      const res = await this.api('/api/clients/update', 'POST', payload);
      if (res && res.success) {
        this.showToast(`Client ${c.email} ${!c.enable ? 'enabled' : 'disabled'}`);
        this.refreshData();
      }
    },

    async resetClientTraffic(c) {
      const ok = await this.askConfirm(`Reset accumulated upload and download traffic statistics for client "${c.email}" to 0?`, {
        title: 'Reset Client Traffic',
        confirmText: 'Reset Counters',
        isDanger: true
      });
      if (!ok) return;
      const res = await this.api('/api/clients/reset-traffic', 'POST', { id: c.id });
      if (res && res.success) {
        this.showToast(`Traffic reset for ${c.email}`);
        this.refreshData();
      }
    },

    generateClientUUID() {
      if (crypto?.randomUUID) {
        this.clientForm.credVal = crypto.randomUUID();
      }
    },

    async saveClient() {
      const quotaGB = parseFloat(this.clientForm.quotaGB) || 0;
      const totalBytes = quotaGB > 0 ? Math.floor(quotaGB * 1024 * 1024 * 1024) : 0;
      const expiryDays = parseInt(this.clientForm.expiryDays) || 0;
      const expiryTime = expiryDays > 0 ? Math.floor(Date.now() / 1000) + (expiryDays * 86400) : 0;

      const payload = {
        id: this.clientForm.id || 0,
        inboundId: this.clientForm.inboundId,
        email: this.clientForm.email,
        flow: this.clientForm.flow,
        total: totalBytes,
        expiryTime,
        enable: this.clientForm.enable
      };

      if (this.clientForm.protocol === 'vless') {
        payload.uuid = this.clientForm.credVal;
      } else {
        payload.password = this.clientForm.credVal;
      }

      const endpoint = this.isEditingClient ? '/api/clients/update' : '/api/clients/create';
      const res = await this.api(endpoint, 'POST', payload);
      if (res && res.success) {
        this.clientModalOpen = false;
        this.showToast(this.isEditingClient ? 'Client updated' : 'User client added');
        this.refreshData();
      } else {
        this.showToast(res?.message || 'Failed to save client', false);
      }
    },

    async deleteClient(id, tag, email) {
      const ok = await this.askConfirm(`Permanently delete client account "${email}"? All authentication credentials will be revoked.`, {
        title: 'Delete Client Account',
        confirmText: 'Delete Client',
        isDanger: true
      });
      if (!ok) return;
      const res = await this.api('/api/clients/delete', 'POST', { id, inboundTag: tag, email });
      if (res && res.success) {
        this.showToast('Client deleted');
        this.refreshData();
      }
    },

    showQR(email, link) {
      this.qrTitle = email;
      this.qrLinkText = link;
      this.qrModalOpen = true;
      this.$nextTick(() => {
        const container = document.getElementById('qrcodeBox');
        if (container) {
          container.innerHTML = '';
          new QRCode(container, {
            text: link,
            width: 190,
            height: 190,
            colorDark: '#1e2127',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      });
    },

    // Realtime Sparkline SVG Generator
    generateSparklinePath(data, width = 280, height = 36, maxVal = null) {
      if (!data || data.length < 2) return '';
      const max = maxVal || Math.max(...data, 1);
      const step = width / (data.length - 1);
      return data.map((val, idx) => {
        const x = (idx * step).toFixed(1);
        const y = (height - (val / max) * (height - 6) - 3).toFixed(1);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    },

    generateSparklineArea(data, width = 280, height = 36, maxVal = null) {
      const linePath = this.generateSparklinePath(data, width, height, maxVal);
      if (!linePath) return '';
      return `${linePath} L ${width} ${height} L 0 ${height} Z`;
    },

    // Formatting Helpers
    formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatSpeed(bytesPerSec) {
      if (!bytesPerSec || bytesPerSec === 0) return '0.00 KB/s';
      const kb = bytesPerSec / 1024;
      if (kb < 1024) return kb.toFixed(2) + ' KB/s';
      return (kb / 1024).toFixed(2) + ' MB/s';
    },

    formatUptime(seconds) {
      if (!seconds || seconds <= 0) return '0m';
      const days = Math.floor(seconds / (3600 * 24));
      const hours = Math.floor((seconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      let res = '';
      if (days > 0) res += days + 'd ';
      if (hours > 0) res += hours + 'h ';
      res += minutes + 'm';
      return res.trim();
    },

    parseStream(inb) {
      try {
        const s = JSON.parse(inb.streamSettings || '{}');
        return `${s.network || 'tcp'} + ${s.security || 'none'}`;
      } catch(e) {
        return 'tcp + none';
      }
    }
  }));
});
