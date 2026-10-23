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
import { LoginPage } from './pages/LoginPage';
import { BackgroundCanvas } from './components/BackgroundCanvas';
import { useNotification } from './context/NotificationContext';

export function App() {
  const { notify } = useNotification();
  const [token, setToken] = useState<string | null>(localStorage.getItem('nexus_token'));
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestartingXray, setIsRestartingXray] = useState(false);

  // Updates
  const [updates, setUpdates] = useState<UpdateInfo>({
    panel: { currentVersion: 'v1.1.0', latestVersion: 'v1.1.0', hasUpdate: false, releaseNotes: '', publishedAt: '' },
    xray: { currentVersion: 'v26.9.30', latestVersion: 'v26.9.30', hasUpdate: false, releaseNotes: '', publishedAt: '' },
  });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isUpdatesModalOpen, setIsUpdatesModalOpen] = useState(false);
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

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStatus(), fetchInbounds(), fetchCertificates(), fetchUpdates()]);
    setIsRefreshing(false);
  }, [fetchStatus, fetchInbounds, fetchCertificates, fetchUpdates]);

  // Periodic Refresh
  useEffect(() => {
    if (!token) return;
    refreshAll();
    const interval = setInterval(() => {
      fetchStatus();
      if (activeTab === 'clients' || activeTab === 'inbounds') {
        fetchInbounds();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [token, refreshAll, fetchStatus, fetchInbounds, activeTab]);

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
    if (!window.confirm('Reset traffic counters for this inbound?')) return;
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
    if (!window.confirm('Are you sure you want to delete this inbound listener and all its client routes?')) return;
    try {
      await api.post('/api/inbounds/delete', { id });
      notify.info('Inbound Deleted', 'Inbound listener has been removed.');
      fetchInbounds();
    } catch (e) {}
  };

  // Client Handlers
  const handleDeleteClient = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this client account?')) return;
    try {
      await api.post('/api/clients/delete', { id });
      notify.info('Client Deleted', 'Client account has been removed.');
      fetchInbounds();
    } catch (e) {}
  };

  const handleResetClientTraffic = async (id: number) => {
    try {
      await api.post(`/api/clients/reset-traffic/${id}`);
      notify.success('Traffic Reset', 'Client usage statistics cleared.');
      fetchInbounds();
    } catch (e) {}
  };

  // Share Generator
  const generateVlessLink = (c: Client, inb: Inbound) => {
    const host = status.publicIP || window.location.hostname;
    let streamSettings: any = {};
    try {
      streamSettings = JSON.parse(inb.streamSettings || '{}');
    } catch (e) {}

    const net = streamSettings.network || 'tcp';
    const sec = streamSettings.security || 'none';
    const params = new URLSearchParams({
      type: net,
      security: sec,
    });

    if (sec === 'reality' && streamSettings.realitySettings) {
      params.set('pbk', streamSettings.realitySettings.settings?.publicKey || '');
      params.set('sni', streamSettings.realitySettings.serverNames?.[0] || 'www.google.com');
      params.set('sid', streamSettings.realitySettings.shortIds?.[0] || '');
      params.set('fp', 'chrome');
      if (c.flow) params.set('flow', c.flow);
    } else if (sec === 'tls' && streamSettings.tlsSettings) {
      if (streamSettings.tlsSettings.serverName) params.set('sni', streamSettings.tlsSettings.serverName);
      if (c.flow) params.set('flow', c.flow);
    }

    if (net === 'ws' && streamSettings.wsSettings) {
      params.set('path', streamSettings.wsSettings.path || '/vless-ws');
      if (streamSettings.wsSettings.headers?.Host) params.set('host', streamSettings.wsSettings.headers.Host);
    } else if (net === 'grpc' && streamSettings.grpcSettings) {
      params.set('serviceName', streamSettings.grpcSettings.serviceName || 'vless-grpc');
    }

    return `vless://${c.uuid}@${host}:${inb.port}?${params.toString()}#${encodeURIComponent(c.email)}`;
  };

  const handleShareInbound = (inb: Inbound) => {
    const client = inb.clients?.[0];
    if (client) {
      const link = generateVlessLink(client, inb);
      setShareModal({
        isOpen: true,
        title: `${inb.remark || inb.tag} (${inb.protocol.toUpperCase()})`,
        link,
      });
    } else {
      notify.warning('No Clients Found', 'This inbound listener has no client accounts assigned yet.');
    }
  };

  const handleShareClient = (client: Client, inb: Inbound) => {
    const link = generateVlessLink(client, inb);
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
    <div className="flex h-screen bg-[#07080b] text-zinc-100 overflow-hidden font-sans select-none relative">
      {/* Premium Black Background Canvas with Architectural Geometry & Nexus N */}
      <BackgroundCanvas />

      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sleek Sidebar with Mobile Drawer support */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        xrayRunning={status.xrayRunning}
        onlineCount={onlineCount}
        inboundsCount={inbounds.length}
        panelVersion={status.panelVersion || 'v1.1.3'}
        onLogout={() => {
          localStorage.removeItem('nexus_token');
          setToken(null);
        }}
        onRestartXray={handleRestartXray}
        isRestartingXray={isRestartingXray}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10 w-full min-w-0">
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
          subtitle={
            activeTab === 'overview'
              ? 'Live system telemetry & network analytics'
              : activeTab === 'inbounds'
              ? 'Configure routing interfaces and ports'
              : undefined
          }
          onRefresh={refreshAll}
          isRefreshing={isRefreshing}
          publicIP={status.publicIP}
          showPublicIP={showPublicIP}
          onToggleShowPublicIP={handleToggleShowPublicIP}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenUpdates={() => setIsUpdatesModalOpen(true)}
          hasUpdates={updates.panel.hasUpdate || updates.xray.hasUpdate}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6 bg-transparent">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <DashboardPage
                status={status}
                inbounds={inbounds}
                onNavigateTab={setActiveTab}
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

            {activeTab === 'config' && <ConfigPage />}

            {activeTab === 'logs' && <LogsPage />}
          </div>
        </main>
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
    </div>
  );
}
