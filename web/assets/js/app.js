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
    clientSearch: '',
    clientStatusFilter: 'all', // 'all', 'online', 'active', 'depleting', 'disabled', 'ended'
    clientSortBy: 'oldest',    // 'oldest', 'newest', 'traffic', 'remaining'
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
        currentVersion: 'v1.0.0',
        latestVersion: 'v1.0.0',
        hasUpdate: false,
        updateUrl: 'https://github.com/ADEL-MAHMOUD10/Nexus-panel/releases'
      },
      xray: {
        currentVersion: 'v26.7.11',
        latestVersion: 'v26.7.11',
        hasUpdate: false,
        updateUrl: 'https://github.com/XTLS/Xray-core/releases'
      }
    },

    // Modals
    inboundModalOpen: false,
    clientModalOpen: false,
    qrModalOpen: false,
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

    init() {
      if (this.token) {
        this.refreshData();
        this.checkUpdates();
        setInterval(() => {
          if (this.token && this.activeTab === 'overview') {
            this.fetchServerStatus();
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

    copy(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard');
      });
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
          cores: st.cpu?.cores || 2,
          freqGHz: st.cpu?.freqGHz ? (Math.round(st.cpu.freqGHz * 100) / 100).toFixed(2) : '3.00',
          model: st.cpu?.model || 'Standard Processor',
          avg: this.calcAvg(this.status.cpu.history),
          peak: Math.max(...this.status.cpu.history),
          history: this.status.cpu.history
        },
        mem: {
          usedPercent: memVal,
          used: st.mem?.used || 0,
          total: st.mem?.total || 0,
          free: st.mem?.free || 0,
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

    async openLogs() {
      this.logsModalOpen = true;
      this.refreshLogs();
    },

    async refreshLogs() {
      const res = await this.api('/api/server/logs');
      if (res && res.logs) {
        this.logsList = res.logs;
      }
    },

    async openConfig() {
      this.configModalOpen = true;
      const res = await this.api('/api/server/config');
      if (res && res.config) {
        this.rawConfigText = res.config;
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
            const isOnline = trafficUsed > 0;
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

      // Search by email, comment, UUID, subID, port
      if (this.clientSearch) {
        const q = this.clientSearch.toLowerCase().trim();
        list = list.filter(c => 
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.uuid && c.uuid.toLowerCase().includes(q)) ||
          (c.subId && c.subId.toLowerCase().includes(q)) ||
          (c.inboundRemark && c.inboundRemark.toLowerCase().includes(q)) ||
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
      if (this.selectedClientIds.length === currentList.length) {
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
      const targetVersion = this.updates.panel.latestVersion || 'v3.9.0';
      const ok = await this.askConfirm(`Upgrade Nexus Panel to ${targetVersion}? The updater script will run on the VPS and restart the management interface.`, {
        title: 'Upgrade Nexus Panel',
        confirmText: 'Start Panel Upgrade',
        isDanger: false
      });
      if (!ok) return;

      this.isUpdatingPanel = true;
      try {
        const res = await this.api('/api/server/update-panel', 'POST');
        if (res && res.success) {
          this.showToast(res.message || 'Panel updater started');
          setTimeout(async () => {
            await this.checkUpdates();
            this.isUpdatingPanel = false;
          }, 5000);
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
      this.inboundModalTab = 'basics';
      this.inboundForm.remark = 'VLESS-TLS-' + Math.floor(Math.random() * 900 + 100);

      // Pick an unused port by default to prevent immediate conflict
      const usedPorts = new Set(this.inbounds.map(i => i.port));
      const defaultCandidates = [443, 8443, 2053, 2083, 2087, 2096, 8080, 8880];
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

    async saveInbound() {
      const port = parseInt(this.inboundForm.port);
      if (!port || port <= 0 || port > 65535) {
        this.showToast('Please enter a valid port between 1 and 65535', false);
        return;
      }

      const listen = (this.inboundForm.listen || '0.0.0.0').trim();
      const net = this.inboundForm.network;
      const isTargetUDP = (this.inboundForm.protocol === 'hysteria' || this.inboundForm.protocol === 'tuic' || net === 'kcp' || net === 'quic');

      // Check conflict locally across active inbounds list
      const conflict = this.inbounds.find(existing => {
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
        // If either is wildcard 0.0.0.0, or both listen to same IP
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

      const res = await this.api('/api/inbounds/create', 'POST', payload);
      if (res && res.success) {
        this.inboundModalOpen = false;
        this.showToast('Inbound configured successfully');
        this.refreshData();
      } else {
        this.showToast(res?.message || 'Failed to configure inbound', false);
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
