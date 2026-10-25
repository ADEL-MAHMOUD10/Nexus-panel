import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './services/api';
import { ServerStatus, Inbound, Client, SSLCertificate, UpdateInfo } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { InboundsPage } from './pages/InboundsPage';
import { ClientsPage } from './pages/ClientsPage';
import { CertificatesPage } from './pages/CertificatesPage';
import { ConfigPage } from './pages/ConfigPage';
import { LogsPage } from './pages/LogsPage';
import { InboundModal } from './components/InboundModal';
import { ClientModal } from './components/ClientModal';
import { ShareModal } from './components/ShareModal';
import { UpdatesModal } from './components/UpdatesModal';
import { XrayLogModal } from './components/XrayLogModal';
import { XrayMetricsModal } from './components/XrayMetricsModal';
import { BackupModal } from './components/BackupModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LoginPage } from './pages/LoginPage';
import { BackgroundCanvas } from './components/BackgroundCanvas';
import { useNotification } from './context/NotificationContext';
import { useConfirm } from './context/ConfirmContext';
import { getTabFromPath, getPathFromTab, getTitleFromTab, getSubtitleFromTab } from './router/routes';

export function App() {
  const { notify } = useNotification();
  const confirm = useConfirm();
  const [token, setToken] = useState<string | null>(localStorage.getItem('nexus_token'));
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return getTabFromPath(window.location.pathname);
  });

  // Dedicated navigation function that synchronizes React state, browser URL, and document title
  const handleNavigate = useCallback((tab: string, replace = false) => {
    setActiveTabState(tab);
    const newPath = getPathFromTab(tab);
    if (window.location.pathname !== newPath) {
      if (replace) {
        window.history.replaceState({ tab }, '', newPath);
      } else {
        window.history.pushState({ tab }, '', newPath);
      }
    }
    document.title = getTitleFromTab(tab);
  }, []);

  // Browser back/forward navigation listener and initial title hydration
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      setActiveTabState(tab);
      document.title = getTitleFromTab(tab);
    };

    window.addEventListener('popstate', handlePopState);
    document.title = getTitleFromTab(activeTab);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestartingXray, setIsRestartingXray] = useState(false);

  // Updates
  const [updates, setUpdates] = useState<UpdateInfo>({
    panel: { currentVersion: 'v1.3.1', latestVersion: 'v1.3.1', hasUpdate: false, releaseNotes: '', publishedAt: '' },
    xray: { currentVersion: 'v26.9.30', latestVersion: 'v26.9.30', hasUpdate: false, releaseNotes: '', publishedAt: '' },
  });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isUpdatesModalOpen, setIsUpdatesModalOpen] = useState(false);
  const [isXrayLogModalOpen, setIsXrayLogModalOpen] = useState(false);
  const [isXrayMetricsModalOpen, setIsXrayMetricsModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const updateNotifiedRef = useRef<string | null>(null);

  // Core Data
  const [status, setStatus] = useState<ServerStatus>({
    xrayRunning: true,
    xrayVersion: 'v26.9.30',
    serverTime: 0,
    cpu: { usedPercent: 12, cores: 2, freqGHz: 3.0, model: 'Proc', avg: 10, peak: 20, history: [10, 12, 14, 11, 15] },
    mem: { usedPercent: 35, used: 1024, total: 4096, free: 3072, avg: 34, peak: 40, history: [32, 34, 35, 36] },
    swap: { usedPercent: 0, used: 0, total: 0 },
    disk: { usedPercent: 42, used: 20, total: 50, free: 30 },
    net: { bytesSent: 0, bytesRecv: 0, speedUp: 0, speedDown: 0, peakSpeed: 0, historyUp: [], historyDown: [] },
    sockets: { total: 0, tcp: 0, udp: 0 },
    uptime: { os: 'Loading...', xray: 'Loading...' },
    panel: { memMB: 15, threads: 8 },
    os: 'Linux Core',
    publicIP: '',
  });

  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);

  // Modals state
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);
  const [inboundToEdit, setInboundToEdit] = useState<Inbound | null>(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [shareModal, setShareModal] = useState<{ isOpen: boolean; title: string; link: string }>({
    isOpen: false,
    title: '',
    link: '',
  });

  // Public IP visibility (masked by default, persists in localStorage)
  const [showPublicIP, setShowPublicIP] = useState<boolean>(() => {
    return localStorage.getItem('nexus_show_public_ip') === 'true';
  });

  const handleToggleShowPublicIP = () => {
    setShowPublicIP((prev) => {
      const next = !prev;
      localStorage.setItem('nexus_show_public_ip', String(next));
      return next;
    });
  };

  // Mobile sidebar drawer state & PC Hover/Pin state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    try {
      return localStorage.getItem('nexus_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarPin = () => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nexus_sidebar_pinned', String(next));
      } catch {}
      return next;
    });
  };

  // Handle unauthorized event
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
    };
    window.addEventListener('nexus:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nexus:unauthorized', handleUnauthorized);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
    if (bytesPerSec >= 1024 * 1024 * 1024) {
      return (bytesPerSec / (1024 * 1024 * 1024)).toFixed(2) + ' GB/s';
    }
    if (bytesPerSec >= 1024 * 1024) {
      return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
    }
    if (bytesPerSec >= 1024) {
      return (bytesPerSec / 1024).toFixed(2) + ' KB/s';
    }
    return Math.round(bytesPerSec) + ' B/s';
  };

  // Fetch telemetry status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/server/status');
      if (res.data) {
        setStatus((prev) => ({
          ...prev,
          ...res.data,
          cpu: {
            ...prev.cpu,
            ...res.data.cpu,
            history: [...(prev.cpu.history.slice(-15)), res.data.cpu?.usedPercent || 0],
          },
          mem: {
            ...prev.mem,
            ...res.data.mem,
            history: [...(prev.mem.history.slice(-15)), res.data.mem?.usedPercent || 0],
          },
          net: {
            ...prev.net,
            ...res.data.net,
            peakSpeed: Math.max(
              prev.net?.peakSpeed || 0,
              res.data.net?.speedUp || 0,
              res.data.net?.speedDown || 0
            ),
            historyUp: [...(prev.net.historyUp.slice(-15)), res.data.net?.speedUp ? res.data.net.speedUp / 1024 : 0],
            historyDown: [...(prev.net.historyDown.slice(-15)), res.data.net?.speedDown ? res.data.net.speedDown / 1024 : 0],
          },
        }));
      }
    } catch (e) {}
  }, []);

  // Fetch Inbounds & Clients
  const fetchInbounds = useCallback(async () => {
    try {
      const res = await api.get('/api/inbounds/list');
      if (res.data && res.data.inbounds) {
        setInbounds(res.data.inbounds);
      }
    } catch (e) {}
  }, []);

  // Fetch Certificates
  const fetchCertificates = useCallback(async () => {
    try {
      const res = await api.get('/api/server/certificates');
      if (res.data && res.data.certificates) {
        setCertificates(res.data.certificates);
      }
    } catch (e) {}
  }, []);

  // Fetch Updates
  const fetchUpdates = useCallback(async () => {
    setIsCheckingUpdates(true);
    try {
      const res = await api.get('/api/server/check-updates');
      if (res.data) {
        setUpdates(res.data);
        const hasUpdate = res.data.panel?.hasUpdate || res.data.xray?.hasUpdate;
        const updateKey = `${res.data.panel?.latestVersion}-${res.data.xray?.latestVersion}`;
        if (hasUpdate && updateNotifiedRef.current !== updateKey) {
          updateNotifiedRef.current = updateKey;
          notify.info(
            'Update Available',
            res.data.panel?.hasUpdate 
              ? `Nexus Panel ${res.data.panel.latestVersion} is ready to install.` 
              : `Xray-core ${res.data.xray.latestVersion} update available.`,
            {
              label: 'View Updates',
              onClick: () => setIsUpdatesModalOpen(true),
            },
            6000
          );
        }
      }
    } catch (e) {}
    setIsCheckingUpdates(false);
  }, [notify]);

  const [justRefreshed, setJustRefreshed] = useState(false);

  const refreshAll = useCallback(async (isManual: boolean = false) => {
    setIsRefreshing(true);
    const minDelay = isManual ? new Promise((res) => setTimeout(res, 750)) : Promise.resolve();
    try {
      await Promise.all([fetchStatus(), fetchInbounds(), fetchCertificates(), fetchUpdates(), minDelay]);
      if (isManual) {
        setJustRefreshed(true);
        notify.success('Telemetry Synchronized', 'System metrics, inbound traffic, and core state updated.');
        setTimeout(() => setJustRefreshed(false), 1600);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStatus, fetchInbounds, fetchCertificates, fetchUpdates, notify]);

  // Global Keyboard Shortcut: Press 'R' to refresh data
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          refreshAll(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refreshAll]);

  // Periodic Refresh
  useEffect(() => {
    if (!token) return;
    refreshAll();
    const interval = setInterval(() => {
      fetchStatus();
      fetchInbounds();
    }, 2500);
    return () => clearInterval(interval);
  }, [token, refreshAll, fetchStatus, fetchInbounds]);

  // Restart Xray-core
  const handleRestartXray = async () => {
    setIsRestartingXray(true);
    try {
      await api.post('/api/server/restart-xray');
      notify.success('Xray Core Restarted', 'Core service reloaded and synced with running configuration.');
      await refreshAll();
    } catch (e: any) {
      notify.error('Restart Failed', e.response?.data?.message || 'Could not reload Xray kernel process');
    }
    setIsRestartingXray(false);
  };

  // Inbound Handlers
  const handleToggleEnable = async (inb: Inbound) => {
    try {
      await api.post(`/api/inbounds/toggle/${inb.id}`);
      notify.info('Inbound Updated', `Listener on port ${inb.port} status changed.`);
      fetchInbounds();
    } catch (e) {}
  };

  const handleResetTraffic = async (id: number) => {
    const ok = await confirm({
      title: 'Reset Inbound Traffic',
      message: 'Reset upload and download traffic counters for this inbound listener to zero?',
      confirmText: 'Reset Counters',
      cancelText: 'Cancel',
      variant: 'warning',
      icon: 'reset',
    });
    if (!ok) return;

    try {
      await api.post(`/api/inbounds/reset-traffic/${id}`);
      notify.success('Traffic Counters Reset', 'Inbound traffic stats have been reset to zero.');
      fetchInbounds();
    } catch (e) {}
  };

  const handleCloneInbound = async (id: number) => {
    try {
      await api.post(`/api/inbounds/clone/${id}`);
      notify.success('Inbound Cloned', 'Cloned listener created with unique port and credentials.');
      fetchInbounds();
    } catch (e) {}
  };

  const handleDeleteInbound = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Inbound Listener',
      message: 'Are you sure you want to delete this inbound listener and all its associated client routes? This action cannot be undone.',
      confirmText: 'Delete Inbound',
      cancelText: 'Cancel',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    try {
      await api.post('/api/inbounds/delete', { id });
      notify.info('Inbound Deleted', 'Inbound listener has been removed.');
      fetchInbounds();
    } catch (e) {}
  };

  // Client Handlers
  const handleDeleteClient = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Client Account',
      message: 'Are you sure you want to delete this client account? Their access credentials will be immediately revoked from the Xray routing kernel.',
      confirmText: 'Delete Client',
      cancelText: 'Cancel',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    try {
      await api.post('/api/clients/delete', { id });
      notify.info('Client Deleted', 'Client account has been removed.');
      fetchInbounds();
    } catch (e) {}
  };

  const handleResetClientTraffic = async (id: number) => {
    const ok = await confirm({
      title: 'Reset Client Usage',
      message: 'Reset upload and download traffic statistics for this client account to zero?',
      confirmText: 'Reset Usage',
      cancelText: 'Cancel',
      variant: 'warning',
      icon: 'reset',
    });
    if (!ok) return;

    try {
      await api.post(`/api/clients/reset-traffic/${id}`);
      notify.success('Traffic Reset', 'Client usage statistics cleared.');
      fetchInbounds();
    } catch (e) {}
  };

  // Universal Multi-Protocol Share Link Generator
  const buildUniversalClientLink = (c: Client, inb: Inbound, host: string): string => {
    let streamSettings: any = {};
    try {
      streamSettings = JSON.parse(inb.streamSettings || '{}');
    } catch (e) {}

    let settings: any = {};
    try {
      settings = JSON.parse(inb.settings || '{}');
    } catch (e) {}

    const proto = (inb.protocol || 'vless').toLowerCase();
    const net = streamSettings.network || streamSettings.method || 'tcp';
    const sec = streamSettings.security || 'none';
    const remark = `${inb.remark || inb.tag}${c.email ? '-' + c.email : ''}`;

    const params = new URLSearchParams({
      type: net,
      security: sec,
    });

    if (sec === 'reality' && streamSettings.realitySettings) {
      params.set('pbk', streamSettings.realitySettings.settings?.publicKey || '');
      params.set('sni', streamSettings.realitySettings.serverNames?.[0] || 'www.google.com');
      params.set('sid', streamSettings.realitySettings.shortIds?.[0] || '');
      params.set('fp', 'chrome');
      if (proto === 'vless' && net === 'tcp' && c.flow) {
        params.set('flow', c.flow);
      }
    } else if (sec === 'tls' && streamSettings.tlsSettings) {
      if (streamSettings.tlsSettings.serverName) params.set('sni', streamSettings.tlsSettings.serverName);
      if (proto === 'vless' && net === 'tcp' && c.flow) {
        params.set('flow', c.flow);
      }
    }

    if (net === 'ws' && streamSettings.wsSettings) {
      params.set('path', streamSettings.wsSettings.path || '/ws');
      if (streamSettings.wsSettings.headers?.Host) params.set('host', streamSettings.wsSettings.headers.Host);
    } else if (net === 'grpc' && streamSettings.grpcSettings) {
      params.set('serviceName', streamSettings.grpcSettings.serviceName || 'grpc');
    } else if (net === 'httpupgrade' && streamSettings.httpupgradeSettings) {
      params.set('path', streamSettings.httpupgradeSettings.path || '/httpupgrade');
      if (streamSettings.httpupgradeSettings.host) params.set('host', streamSettings.httpupgradeSettings.host);
    } else if (net === 'xhttp' && streamSettings.xhttpSettings) {
      params.set('path', streamSettings.xhttpSettings.path || '/');
      if (streamSettings.xhttpSettings.host) params.set('host', streamSettings.xhttpSettings.host);
    }

    switch (proto) {
      case 'vless':
        params.set('encryption', 'none');
        return `vless://${c.uuid}@${host}:${inb.port}?${params.toString()}#${encodeURIComponent(remark)}`;

      case 'trojan':
        const trojanPwd = c.password || c.uuid;
        params.delete('flow');
        return `trojan://${encodeURIComponent(trojanPwd)}@${host}:${inb.port}?${params.toString()}#${encodeURIComponent(remark)}`;

      case 'vmess':
        const vmessObj = {
          v: '2',
          ps: remark,
          add: host,
          port: inb.port,
          id: c.uuid,
          aid: 0,
          scy: 'auto',
          net: net,
          type: 'none',
          host: params.get('host') || '',
          path: params.get('path') || '',
          tls: sec,
          sni: params.get('sni') || '',
        };
        return `vmess://${btoa(unescape(encodeURIComponent(JSON.stringify(vmessObj))))}`;

      case 'shadowsocks':
        const method = settings.method || '2022-blake3-aes-128-gcm';
        const ssPwd = c.password || c.uuid || settings.password || '';
        const userInfo = btoa(`${method}:${ssPwd}`);
        return `ss://${userInfo}@${host}:${inb.port}#${encodeURIComponent(remark)}`;

      case 'hysteria':
      case 'hysteria2':
        const hyAuth = c.password || c.uuid;
        const hySni = params.get('sni') || host;
        return `hy2://${encodeURIComponent(hyAuth)}@${host}:${inb.port}?sni=${encodeURIComponent(hySni)}#${encodeURIComponent(remark)}`;

      case 'wireguard':
        const wgClientPriv = c.uuid || c.password || '';
        const wgServerPub = settings.serverPublicKey || c.password || c.uuid || '';
        const wgMtu = settings.mtu || 1420;
        return `wireguard://${encodeURIComponent(wgClientPriv)}@${host}:${inb.port}?publickey=${encodeURIComponent(wgServerPub)}&address=10.0.0.2/32&mtu=${wgMtu}#${encodeURIComponent(remark)}`;

      case 'socks':
        return `socks5://${encodeURIComponent(c.email)}:${encodeURIComponent(c.password || c.uuid)}@${host}:${inb.port}#${encodeURIComponent(remark)}`;

      case 'http':
        return `http://${encodeURIComponent(c.email)}:${encodeURIComponent(c.password || c.uuid)}@${host}:${inb.port}#${encodeURIComponent(remark)}`;

      default:
        return `vless://${c.uuid}@${host}:${inb.port}?${params.toString()}#${encodeURIComponent(remark)}`;
    }
  };

  const handleShareInbound = async (inb: Inbound) => {
    const client = inb.clients?.[0];
    if (!client) {
      notify.warning('No Clients Found', 'This inbound listener has no client accounts assigned yet.');
      return;
    }

    let link = client.link || '';
    if (!link) {
      try {
        const res = await api.get(`/api/inbounds/link/${inb.id}`);
        if (res.data?.success && res.data?.link) {
          link = res.data.link;
        }
      } catch (e) {}
    }

    if (!link) {
      const host = status.publicIP || window.location.hostname;
      link = buildUniversalClientLink(client, inb, host);
    }

    setShareModal({
      isOpen: true,
      title: `${inb.remark || inb.tag} (${inb.protocol.toUpperCase()})`,
      link,
    });
  };

  const handleShareClient = async (client: Client, inb: Inbound) => {
    let link = client.link || '';
    if (!link) {
      try {
        const res = await api.get(`/api/clients/link/${client.id}`);
        if (res.data?.success && res.data?.link) {
          link = res.data.link;
        }
      } catch (e) {}
    }

    if (!link) {
      const host = status.publicIP || window.location.hostname;
      link = buildUniversalClientLink(client, inb, host);
    }

    setShareModal({
      isOpen: true,
      title: `${client.email} (${inb.protocol.toUpperCase()})`,
      link,
    });
  };

  const handleIssueCertificate = async (domain: string): Promise<boolean> => {
    try {
      const res = await api.post('/api/server/issue-cert', { domain });
      if (res.data && res.data.success) {
        notify.success('SSL Certificate Active', `Certificate successfully issued for ${domain}!`);
        fetchCertificates();
        return true;
      }
      notify.error('Issuance Failed', res.data?.message || 'Certificate issuance failed');
    } catch (e: any) {
      notify.error('SSL Error', e.response?.data?.message || 'Failed to issue SSL certificate');
    }
    return false;
  };

  // If not authenticated, render Login Page
  if (!token) {
    return <LoginPage onLogin={(t) => setToken(t)} />;
  }

  // Count online clients
  let onlineCount = 0;
  inbounds.forEach((i) => {
    onlineCount += (i.clients || []).filter((c) => c.isOnline).length;
  });

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] bg-[#07080b] text-zinc-100 overflow-hidden font-sans select-none relative">
      {/* Premium Black Background Canvas with Architectural Geometry & Nexus N */}
      <BackgroundCanvas />

      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sleek Sidebar with Mobile Drawer support & PC Hover/Pin behavior */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        xrayRunning={status.xrayRunning}
        onlineCount={onlineCount}
        inboundsCount={inbounds.length}
        panelVersion={status.panelVersion || 'v1.3.1'}
        xrayVersion={status.xrayVersion || 'v26.10.x'}
        publicIP={status.publicIP}
        onLogout={() => {
          localStorage.removeItem('nexus_token');
          setToken(null);
        }}
        onRestartXray={handleRestartXray}
        isRestartingXray={isRestartingXray}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isPinned={isSidebarPinned}
        onTogglePin={handleToggleSidebarPin}
        onOpenUpdates={() => setIsUpdatesModalOpen(true)}
        hasUpdates={updates.panel.hasUpdate || updates.xray.hasUpdate}
      />

      {/* Desktop Spacer: w-[68px] when collapsed (hover to open), w-64 when pinned */}
      <div className={`hidden md:block shrink-0 transition-all duration-300 ease-in-out ${isSidebarPinned ? 'w-64' : 'w-[68px]'}`} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative z-10 w-full min-w-0">
        {/* Header */}
        <Header
          title={
            activeTab === 'overview'
              ? 'Executive Dashboard'
              : activeTab === 'inbounds'
              ? 'Proxy Inbound Listeners'
              : activeTab === 'clients'
              ? 'Client Routes & Accounts'
              : activeTab === 'certificates'
              ? 'SSL & Security'
              : activeTab === 'config'
              ? 'Core Engine Configuration'
              : 'Xray Logs'
          }
          subtitle={getSubtitleFromTab(activeTab)}
          onRefresh={() => refreshAll(true)}
          isRefreshing={isRefreshing}
          justRefreshed={justRefreshed}
          publicIP={status.publicIP}
          showPublicIP={showPublicIP}
          onToggleShowPublicIP={handleToggleShowPublicIP}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenUpdates={() => setIsUpdatesModalOpen(true)}
          hasUpdates={updates.panel.hasUpdate || updates.xray.hasUpdate}
          onOpenXrayLogs={() => setIsXrayLogModalOpen(true)}
          onOpenXrayMetrics={() => setIsXrayMetricsModalOpen(true)}
          onOpenBackup={() => setIsBackupModalOpen(true)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6 pb-20 md:pb-6 bg-transparent">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <DashboardPage
                status={status}
                inbounds={inbounds}
                onNavigateTab={handleNavigate}
                formatBytes={formatBytes}
                formatSpeed={formatSpeed}
                updates={updates}
                onOpenUpdatesModal={() => setIsUpdatesModalOpen(true)}
                onRestartXray={handleRestartXray}
                isRestartingXray={isRestartingXray}
                showPublicIP={showPublicIP}
                onToggleShowPublicIP={handleToggleShowPublicIP}
              />
            )}

            {activeTab === 'inbounds' && (
              <InboundsPage
                inbounds={inbounds}
                onOpenAddModal={() => {
                  setInboundToEdit(null);
                  setIsInboundModalOpen(true);
                }}
                onOpenEditModal={(inb) => {
                  setInboundToEdit(inb);
                  setIsInboundModalOpen(true);
                }}
                onToggleEnable={handleToggleEnable}
                onResetTraffic={handleResetTraffic}
                onCloneInbound={handleCloneInbound}
                onDeleteInbound={handleDeleteInbound}
                onShareInbound={handleShareInbound}
                formatBytes={formatBytes}
                formatSpeed={formatSpeed}
              />
            )}

            {activeTab === 'clients' && (
              <ClientsPage
                inbounds={inbounds}
                onOpenAddClient={() => {
                  setClientToEdit(null);
                  setIsClientModalOpen(true);
                }}
                onOpenEditClient={(client) => {
                  setClientToEdit(client);
                  setIsClientModalOpen(true);
                }}
                onDeleteClient={handleDeleteClient}
                onResetClientTraffic={handleResetClientTraffic}
                onShareClient={handleShareClient}
                formatBytes={formatBytes}
                formatSpeed={formatSpeed}
                onRefreshInbounds={fetchInbounds}
              />
            )}

            {activeTab === 'certificates' && (
              <CertificatesPage
                certificates={certificates}
                onIssueCertificate={handleIssueCertificate}
                onRefresh={fetchCertificates}
                isIssuing={false}
              />
            )}

            {activeTab === 'config' && <ConfigPage onOpenBackup={() => setIsBackupModalOpen(true)} />}

            {activeTab === 'logs' && <LogsPage />}
          </div>
        </main>

        {/* Mobile Quick Bottom Navigation */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={handleNavigate}
          onlineCount={onlineCount}
          inboundsCount={inbounds.length}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />
      </div>

      {/* Modals */}
      <InboundModal
        isOpen={isInboundModalOpen}
        onClose={() => setIsInboundModalOpen(false)}
        onSaved={fetchInbounds}
        inboundToEdit={inboundToEdit}
      />

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSaved={fetchInbounds}
        inbounds={inbounds}
        clientToEdit={clientToEdit}
      />

      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, title: '', link: '' })}
        title={shareModal.title}
        link={shareModal.link}
      />

      <UpdatesModal
        isOpen={isUpdatesModalOpen}
        onClose={() => setIsUpdatesModalOpen(false)}
        updates={updates}
        onRefresh={fetchUpdates}
        isChecking={isCheckingUpdates}
      />

      <XrayLogModal
        isOpen={isXrayLogModalOpen}
        onClose={() => setIsXrayLogModalOpen(false)}
      />

      <XrayMetricsModal
        isOpen={isXrayMetricsModalOpen}
        onClose={() => setIsXrayMetricsModalOpen(false)}
        formatBytes={formatBytes}
        formatSpeed={formatSpeed}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreSuccess={refreshAll}
      />
    </div>
  );
}
