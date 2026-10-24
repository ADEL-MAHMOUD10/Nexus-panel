import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Key, RefreshCw, Shield, Zap, Sliders, Radio, Globe, Lock, Cpu, Server } from 'lucide-react';
import api from '../services/api';
import { Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';

interface InboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  inboundToEdit?: Inbound | null;
}

export const InboundModal: React.FC<InboundModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  inboundToEdit,
}) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'basics' | 'transport' | 'security' | 'advanced'>('basics');
  
  // 1. Basics Form
  const [remark, setRemark] = useState('');
  const [port, setPort] = useState<number>(443);
  const [listen, setListen] = useState('0.0.0.0');
  const [protocol, setProtocol] = useState('vless');
  const [totalGB, setTotalGB] = useState<number>(0);
  const [expiryDays, setExpiryDays] = useState<number>(0);

  // 2. Transport Networks
  const [network, setNetwork] = useState('tcp');
  
  // WebSocket
  const [wsPath, setWsPath] = useState('/vless-ws');
  const [wsHost, setWsHost] = useState('');
  
  // gRPC
  const [grpcServiceName, setGrpcServiceName] = useState('vless-grpc');
  const [grpcMultiMode, setGrpcMultiMode] = useState(false);

  // HTTPUpgrade
  const [httpUpgradePath, setHttpUpgradePath] = useState('/httpupgrade');
  const [httpUpgradeHost, setHttpUpgradeHost] = useState('');

  // SplitHTTP / XHTTP
  const [splitHttpPath, setSplitHttpPath] = useState('/xhttp');
  const [splitHttpHost, setSplitHttpHost] = useState('');
  const [splitHttpMode, setSplitHttpMode] = useState('stream-up');

  // mKCP (UDP Stream)
  const [kcpHeaderType, setKcpHeaderType] = useState('none');
  const [kcpSeed, setKcpSeed] = useState('');
  const [kcpMtu, setKcpMtu] = useState<number>(1350);
  const [kcpTti, setKcpTti] = useState<number>(50);
  const [kcpUpCap, setKcpUpCap] = useState<number>(5);
  const [kcpDownCap, setKcpDownCap] = useState<number>(20);
  const [kcpCongestion, setKcpCongestion] = useState(false);

  // TCP Header
  const [tcpHeaderType, setTcpHeaderType] = useState('none');

  // 3. Security (TLS / REALITY)
  const [security, setSecurity] = useState('tls'); // none, tls, reality
  const [tlsSNI, setTlsSNI] = useState('');
  const [tlsALPN, setTlsALPN] = useState('h2,http/1.1');
  const [tlsMinVersion, setTlsMinVersion] = useState('1.2');
  const [tlsMaxVersion, setTlsMaxVersion] = useState('1.3');

  // REALITY
  const [realityDest, setRealityDest] = useState('www.google.com:443');
  const [realityServerNames, setRealityServerNames] = useState('www.google.com');
  const [realityPrivKey, setRealityPrivKey] = useState('');
  const [realityPubKey, setRealityPubKey] = useState('');
  const [realityShortId, setRealityShortId] = useState('');
  const [realitySpiderX, setRealitySpiderX] = useState('/');

  // 4. Advanced & Sockopt
  const [sockoptTcpFastOpen, setSockoptTcpFastOpen] = useState(true);
  const [sockoptAcceptProxyProtocol, setSockoptAcceptProxyProtocol] = useState(false);
  const [sockoptTproxy, setSockoptTproxy] = useState('off');
  const [sockoptMark, setSockoptMark] = useState<number>(0);

  // Sniffing
  const [sniffingEnabled, setSniffingEnabled] = useState(true);
  const [sniffHttp, setSniffHttp] = useState(true);
  const [sniffTls, setSniffTls] = useState(true);
  const [sniffQuic, setSniffQuic] = useState(true);
  const [sniffFakedns, setSniffFakedns] = useState(true);
  const [sniffRouteOnly, setSniffRouteOnly] = useState(false);

  // Protocol-Specific Settings
  // Shadowsocks
  const [ssMethod, setSsMethod] = useState('2022-blake3-aes-128-gcm');
  const [ssPassword, setSsPassword] = useState('');
  const [ssNetwork, setSsNetwork] = useState('tcp,udp');

  // WireGuard
  const [wgSecretKey, setWgSecretKey] = useState('');
  const [wgMtu, setWgMtu] = useState<number>(1420);

  // Hysteria
  const [hyAuth, setHyAuth] = useState('');
  const [hyUpMbps, setHyUpMbps] = useState<number>(100);
  const [hyDownMbps, setHyDownMbps] = useState<number>(100);

  // Dokodemo-door
  const [dokoAddress, setDokoAddress] = useState('127.0.0.1');
  const [dokoPort, setDokoPort] = useState<number>(0);
  const [dokoFollowRedirect, setDokoFollowRedirect] = useState(false);

  // Fallbacks raw JSON
  const [fallbacksJson, setFallbacksJson] = useState('[]');

  // Real-time Port Collision Detection state
  const [portConflict, setPortConflict] = useState<string | null>(null);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Populate data when editing
  useEffect(() => {
    if (inboundToEdit) {
      setRemark(inboundToEdit.remark || inboundToEdit.tag || '');
      setPort(inboundToEdit.port);
      setListen(inboundToEdit.listen || '0.0.0.0');
      setProtocol(inboundToEdit.protocol || 'vless');
      setTotalGB(inboundToEdit.total ? Number((inboundToEdit.total / (1024 ** 3)).toFixed(2)) : 0);
      
      // Parse settings
      try {
        const sett = JSON.parse(inboundToEdit.settings || '{}');
        if (sett.method) setSsMethod(sett.method);
        if (sett.password) setSsPassword(sett.password);
        if (sett.network) setSsNetwork(sett.network);
        if (sett.secretKey) setWgSecretKey(sett.secretKey);
        if (sett.mtu) setWgMtu(sett.mtu);
        if (sett.address) setDokoAddress(sett.address);
        if (sett.port) setDokoPort(sett.port);
        if (sett.followRedirect !== undefined) setDokoFollowRedirect(sett.followRedirect);
        if (sett.fallbacks) setFallbacksJson(JSON.stringify(sett.fallbacks, null, 2));
      } catch (e) {}

      // Parse streamSettings
      try {
        const ss = JSON.parse(inboundToEdit.streamSettings || '{}');
        setNetwork(ss.network || ss.method || 'tcp');
        setSecurity(ss.security || 'none');
        
        if (ss.tcpSettings?.header?.type) {
          setTcpHeaderType(ss.tcpSettings.header.type);
        }
        if (ss.wsSettings) {
          setWsPath(ss.wsSettings.path || '/vless-ws');
          setWsHost(ss.wsSettings.headers?.Host || ss.wsSettings.host || '');
        }
        if (ss.grpcSettings) {
          setGrpcServiceName(ss.grpcSettings.serviceName || 'vless-grpc');
          setGrpcMultiMode(Boolean(ss.grpcSettings.multiMode));
        }
        if (ss.httpupgradeSettings) {
          setHttpUpgradePath(ss.httpupgradeSettings.path || '/httpupgrade');
          setHttpUpgradeHost(ss.httpupgradeSettings.host || '');
        }
        if (ss.xhttpSettings || ss.splithttpSettings) {
          const xh = ss.xhttpSettings || ss.splithttpSettings;
          setSplitHttpPath(xh.path || '/xhttp');
          setSplitHttpHost(xh.host || '');
          setSplitHttpMode(xh.mode || 'stream-up');
        }
        if (ss.kcpSettings) {
          setKcpHeaderType(ss.kcpSettings.header?.type || 'none');
          setKcpSeed(ss.kcpSettings.seed || '');
          if (ss.kcpSettings.mtu) setKcpMtu(ss.kcpSettings.mtu);
          if (ss.kcpSettings.tti) setKcpTti(ss.kcpSettings.tti);
          if (ss.kcpSettings.uplinkCapacity) setKcpUpCap(ss.kcpSettings.uplinkCapacity);
          if (ss.kcpSettings.downlinkCapacity) setKcpDownCap(ss.kcpSettings.downlinkCapacity);
          if (ss.kcpSettings.congestion !== undefined) setKcpCongestion(ss.kcpSettings.congestion);
        }
        if (ss.tlsSettings) {
          setTlsSNI(ss.tlsSettings.serverName || '');
          setTlsALPN(Array.isArray(ss.tlsSettings.alpn) ? ss.tlsSettings.alpn.join(',') : 'h2,http/1.1');
          if (ss.tlsSettings.minVersion) setTlsMinVersion(ss.tlsSettings.minVersion);
          if (ss.tlsSettings.maxVersion) setTlsMaxVersion(ss.tlsSettings.maxVersion);
        }
        if (ss.realitySettings) {
          setRealityDest(ss.realitySettings.dest || 'www.google.com:443');
          setRealityServerNames(ss.realitySettings.serverNames?.join(',') || 'www.google.com');
          setRealityPrivKey(ss.realitySettings.privateKey || '');
          setRealityPubKey(ss.realitySettings.settings?.publicKey || '');
          setRealityShortId(ss.realitySettings.shortIds?.[0] || '');
          setRealitySpiderX(ss.realitySettings.settings?.spiderX || '/');
        }
        if (ss.sockopt) {
          if (ss.sockopt.tcpFastOpen !== undefined) setSockoptTcpFastOpen(Boolean(ss.sockopt.tcpFastOpen));
          if (ss.sockopt.acceptProxyProtocol !== undefined) setSockoptAcceptProxyProtocol(Boolean(ss.sockopt.acceptProxyProtocol));
          if (ss.sockopt.tproxy) setSockoptTproxy(ss.sockopt.tproxy);
          if (ss.sockopt.mark) setSockoptMark(ss.sockopt.mark);
        }
      } catch (e) {}

      // Parse sniffing
      try {
        const sn = JSON.parse(inboundToEdit.sniffing || '{}');
        setSniffingEnabled(sn.enabled !== false);
        if (Array.isArray(sn.destOverride)) {
          setSniffHttp(sn.destOverride.includes('http'));
          setSniffTls(sn.destOverride.includes('tls'));
          setSniffQuic(sn.destOverride.includes('quic'));
          setSniffFakedns(sn.destOverride.includes('fakedns'));
        }
        if (sn.routeOnly !== undefined) setSniffRouteOnly(sn.routeOnly);
      } catch (e) {}

    } else {
      // New Inbound defaults
      setRemark('VLESS-REALITY-' + Math.floor(Math.random() * 900 + 100));
      setPort(2053);
      setListen('0.0.0.0');
      setProtocol('vless');
      setNetwork('tcp');
      setSecurity('reality');
      handleGenerateRealityKeys();
    }
  }, [inboundToEdit, isOpen]);

  // Debounced Live Port Collision Check
  useEffect(() => {
    if (!port || port <= 0 || port > 65535) {
      setPortConflict('Invalid port number');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingPort(true);
        const query = new URLSearchParams({
          port: port.toString(),
          protocol: protocol,
          streamSettings: JSON.stringify({ network }),
          listen,
          ignoreId: inboundToEdit ? inboundToEdit.id.toString() : '0',
        });
        const res = await api.get(`/api/inbounds/check-port?${query.toString()}`);
        if (res.data && !res.data.available) {
          setPortConflict(res.data.message || `Port ${port} is not available.`);
        } else {
          setPortConflict(null);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsCheckingPort(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [port, protocol, network, listen, inboundToEdit]);

  const handleGenerateRealityKeys = async () => {
    try {
      const res = await api.get('/api/crypto/reality-keys');
      if (res.data && res.data.success) {
        setRealityPrivKey(res.data.privateKey || '');
        setRealityPubKey(res.data.publicKey || '');
        setRealityShortId(res.data.shortId || '');
      }
    } catch (e) {}
  };

  const handleGenerateWireGuardKeys = async () => {
    try {
      const res = await api.get('/api/crypto/wireguard-keys');
      if (res.data && res.data.success) {
        setWgSecretKey(res.data.privateKey || '');
        notify.success('WireGuard Key Generated', 'Generated new Server Private Key.');
      }
    } catch (e) {}
  };

  const handleGenerateShadowsocksKey = async () => {
    try {
      const bytes = ssMethod.includes('256') ? '32' : '16';
      const res = await api.get(`/api/crypto/shadowsocks-key?bytes=${bytes}`);
      if (res.data && res.data.success) {
        setSsPassword(res.data.key || '');
        notify.success('Key Generated', 'Generated new Shadowsocks key.');
      }
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portConflict) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Build StreamSettings
    const streamSettingsObj: any = {
      network,
      security,
    };

    if (network === 'tcp') {
      if (tcpHeaderType !== 'none') {
        streamSettingsObj.tcpSettings = {
          header: { type: tcpHeaderType },
        };
      }
    } else if (network === 'ws') {
      streamSettingsObj.wsSettings = {
        path: wsPath,
        headers: wsHost ? { Host: wsHost } : {},
      };
    } else if (network === 'grpc') {
      streamSettingsObj.grpcSettings = {
        serviceName: grpcServiceName,
        multiMode: grpcMultiMode,
      };
    } else if (network === 'httpupgrade') {
      streamSettingsObj.httpupgradeSettings = {
        path: httpUpgradePath,
        host: httpUpgradeHost,
      };
    } else if (network === 'splithttp' || network === 'xhttp') {
      streamSettingsObj.network = 'xhttp';
      streamSettingsObj.xhttpSettings = {
        path: splitHttpPath,
        host: splitHttpHost,
        mode: splitHttpMode,
      };
    } else if (network === 'kcp') {
      streamSettingsObj.kcpSettings = {
        mtu: kcpMtu,
        tti: kcpTti,
        uplinkCapacity: kcpUpCap,
        downlinkCapacity: kcpDownCap,
        congestion: kcpCongestion,
        seed: kcpSeed,
        header: { type: kcpHeaderType },
      };
    }

    if (security === 'tls') {
      streamSettingsObj.tlsSettings = {
        serverName: tlsSNI,
        alpn: tlsALPN.split(',').map((s) => s.trim()).filter(Boolean),
        minVersion: tlsMinVersion,
        maxVersion: tlsMaxVersion,
      };
    } else if (security === 'reality') {
      streamSettingsObj.realitySettings = {
        show: false,
        xver: 0,
        dest: realityDest,
        serverNames: realityServerNames.split(',').map((s) => s.trim()).filter(Boolean),
        privateKey: realityPrivKey,
        shortIds: [realityShortId].filter(Boolean),
        settings: {
          publicKey: realityPubKey,
          fingerprint: 'chrome',
          spiderX: realitySpiderX || '/',
        },
      };
    }

    // Sockopt
    streamSettingsObj.sockopt = {
      tcpFastOpen: sockoptTcpFastOpen,
      acceptProxyProtocol: sockoptAcceptProxyProtocol,
      tproxy: sockoptTproxy,
      mark: sockoptMark,
    };

    // Protocol Settings
    let settingsObj: any = { clients: [] };
    if (protocol === 'vless' || protocol === 'trojan' || protocol === 'vmess') {
      let parsedFallbacks = [];
      try {
        parsedFallbacks = JSON.parse(fallbacksJson);
      } catch (e) {}
      settingsObj.decryption = 'none';
      settingsObj.fallbacks = parsedFallbacks;
    } else if (protocol === 'shadowsocks') {
      settingsObj = {
        method: ssMethod,
        password: ssPassword,
        network: ssNetwork,
      };
    } else if (protocol === 'wireguard') {
      settingsObj = {
        secretKey: wgSecretKey,
        mtu: wgMtu,
        peers: [],
      };
    } else if (protocol === 'hysteria') {
      settingsObj = {
        version: 2,
        users: [],
      };
    } else if (protocol === 'dokodemo-door') {
      settingsObj = {
        address: dokoAddress,
        port: dokoPort,
        network: 'tcp,udp',
        followRedirect: dokoFollowRedirect,
      };
    }

    // Sniffing
    const destOverride: string[] = [];
    if (sniffHttp) destOverride.push('http');
    if (sniffTls) destOverride.push('tls');
    if (sniffQuic) destOverride.push('quic');
    if (sniffFakedns) destOverride.push('fakedns');

    const sniffingObj = {
      enabled: sniffingEnabled,
      destOverride,
      routeOnly: sniffRouteOnly,
    };

    const payload: any = {
      port: Number(port),
      protocol,
      remark,
      tag: `in-${port}`,
      listen,
      total: totalGB > 0 ? Math.floor(totalGB * 1024 ** 3) : 0,
      expiryTime: expiryDays > 0 ? Math.floor(Date.now() / 1000) + expiryDays * 86400 : 0,
      settings: JSON.stringify(settingsObj),
      streamSettings: JSON.stringify(streamSettingsObj),
      sniffing: JSON.stringify(sniffingObj),
    };

    try {
      let endpoint = '/api/inbounds/create';
      if (inboundToEdit) {
        payload.id = inboundToEdit.id;
        endpoint = `/api/inbounds/update/${inboundToEdit.id}`;
      }

      const res = await api.post(endpoint, payload);
      if (res.data && res.data.success) {
        notify.success('Inbound Saved', inboundToEdit ? 'Inbound listener updated successfully.' : 'New inbound listener created successfully.');
        onSaved();
        onClose();
      } else {
        const msg = res.data?.message || 'Failed to save inbound listener';
        setErrorMessage(msg);
        notify.error('Save Failed', msg);
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Error communicating with server';
      setErrorMessage(msg);
      notify.error('Save Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0c0d13]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between bg-[#08090d]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                {inboundToEdit ? 'Edit Inbound Listener' : 'Create New Inbound Listener'}
              </h3>
              <span className="text-[11px] text-zinc-400 font-mono">
                {protocol.toUpperCase()} • {network.toUpperCase()} • {security.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.06] px-4 sm:px-6 bg-[#08090d] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('basics')}
            className={`py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'basics'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>1. Basics & Port</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transport')}
            className={`py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'transport'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>2. Transport Network</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>3. Security (REALITY/TLS)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'advanced'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>4. Advanced & Sockopt</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: BASICS */}
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Inbound Remark</label>
                <input
                  type="text"
                  required
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="e.g. VLESS-REALITY-Port443"
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Port with Live Collision Feedback */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-zinc-300">Listening Port</label>
                    {isCheckingPort && (
                      <span className="text-[10px] text-zinc-500 font-mono animate-pulse">Checking...</span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className={`w-full px-3.5 py-2 bg-[#08090d] border rounded-xl text-xs font-mono text-white focus:outline-none transition ${
                      portConflict 
                        ? 'border-rose-500/80 bg-rose-500/10 text-rose-200' 
                        : 'border-white/[0.08] focus:border-cyan-500/50'
                    }`}
                  />
                  {portConflict && (
                    <div className="mt-1.5 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{portConflict}</span>
                    </div>
                  )}
                </div>

                {/* Protocol Selector */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Protocol</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none font-mono uppercase"
                  >
                    <option value="vless">VLESS (Zero-Overhead)</option>
                    <option value="trojan">TROJAN (HTTPS Mimicry)</option>
                    <option value="vmess">VMESS (AEAD)</option>
                    <option value="shadowsocks">SHADOWSOCKS (2022 / AEAD)</option>
                    <option value="wireguard">WIREGUARD (Native UDP)</option>
                    <option value="hysteria">HYSTERIA 2 (High-Speed UDP)</option>
                    <option value="dokodemo-door">DOKODEMO-DOOR (Port Forward)</option>
                    <option value="socks">SOCKS5</option>
                    <option value="http">HTTP PROXY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Listen IP</label>
                  <input
                    type="text"
                    value={listen}
                    onChange={(e) => setListen(e.target.value)}
                    placeholder="0.0.0.0"
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Traffic Quota (GB)</label>
                  <input
                    type="number"
                    min={0}
                    value={totalGB}
                    onChange={(e) => setTotalGB(Number(e.target.value))}
                    placeholder="0 = Unlimited"
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSPORT */}
          {activeTab === 'transport' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Network Stream Layer</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono uppercase"
                >
                  <option value="tcp">TCP (Standard Raw Stream)</option>
                  <option value="ws">WebSocket (WS with CDN Support)</option>
                  <option value="grpc">gRPC (HTTP/2 Multiplexing)</option>
                  <option value="httpupgrade">HTTPUpgrade (Lightweight HTTP/1.1)</option>
                  <option value="splithttp">SplitHTTP / XHTTP (Next-Gen CDN Stream)</option>
                  <option value="kcp">mKCP (High-Performance UDP Stream)</option>
                </select>
              </div>

              {/* WebSocket Config */}
              {network === 'ws' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">WS Path</label>
                    <input
                      type="text"
                      value={wsPath}
                      onChange={(e) => setWsPath(e.target.value)}
                      placeholder="/vless-ws"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">WS Host Header</label>
                    <input
                      type="text"
                      value={wsHost}
                      onChange={(e) => setWsHost(e.target.value)}
                      placeholder="e.g. cdn.domain.com"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* gRPC Config */}
              {network === 'grpc' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">gRPC Service Name</label>
                    <input
                      type="text"
                      value={grpcServiceName}
                      onChange={(e) => setGrpcServiceName(e.target.value)}
                      placeholder="vless-grpc"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={grpcMultiMode}
                      onChange={(e) => setGrpcMultiMode(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Enable MultiMode (Gun architecture)</span>
                  </label>
                </div>
              )}

              {/* HTTPUpgrade Config */}
              {network === 'httpupgrade' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">HTTPUpgrade Path</label>
                    <input
                      type="text"
                      value={httpUpgradePath}
                      onChange={(e) => setHttpUpgradePath(e.target.value)}
                      placeholder="/httpupgrade"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Host Header</label>
                    <input
                      type="text"
                      value={httpUpgradeHost}
                      onChange={(e) => setHttpUpgradeHost(e.target.value)}
                      placeholder="e.g. cdn.domain.com"
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* SplitHTTP / XHTTP Config */}
              {(network === 'splithttp' || network === 'xhttp') && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">XHTTP Path</label>
                      <input
                        type="text"
                        value={splitHttpPath}
                        onChange={(e) => setSplitHttpPath(e.target.value)}
                        placeholder="/xhttp"
                        className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Host Header</label>
                      <input
                        type="text"
                        value={splitHttpHost}
                        onChange={(e) => setSplitHttpHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Mode</label>
                    <select
                      value={splitHttpMode}
                      onChange={(e) => setSplitHttpMode(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                    >
                      <option value="stream-up">stream-up (Continuous uplink stream)</option>
                      <option value="stream-one">stream-one (Bidirectional single stream)</option>
                      <option value="packet-up">packet-up (Packet chunked uplink)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* mKCP UDP Config */}
              {network === 'kcp' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      mKCP High-Speed UDP Configuration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Header Masquerade</label>
                      <select
                        value={kcpHeaderType}
                        onChange={(e) => setKcpHeaderType(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                      >
                        <option value="none">None (Raw KCP)</option>
                        <option value="srtp">SRTP (Video Call Camouflage)</option>
                        <option value="utp">uTP (BitTorrent Camouflage)</option>
                        <option value="wechat-video">WeChat Video Camouflage</option>
                        <option value="dtls">DTLS 1.2 Camouflage</option>
                        <option value="wireguard">WireGuard Packet Camouflage</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seed (Obfuscation Password)</label>
                      <input
                        type="text"
                        value={kcpSeed}
                        onChange={(e) => setKcpSeed(e.target.value)}
                        placeholder="Optional obfuscation seed"
                        className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">MTU (Bytes)</label>
                      <input
                        type="number"
                        min={576}
                        max={1460}
                        value={kcpMtu}
                        onChange={(e) => setKcpMtu(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">TTI (ms)</label>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={kcpTti}
                        onChange={(e) => setKcpTti(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Up Cap (MB/s)</label>
                      <input
                        type="number"
                        min={1}
                        value={kcpUpCap}
                        onChange={(e) => setKcpUpCap(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Down Cap (MB/s)</label>
                      <input
                        type="number"
                        min={1}
                        value={kcpDownCap}
                        onChange={(e) => setKcpDownCap(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={kcpCongestion}
                      onChange={(e) => setKcpCongestion(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Enable Congestion Control (BBR-like algorithm)</span>
                  </label>
                </div>
              )}

              {/* TCP Header Type */}
              {network === 'tcp' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">TCP Header Obfuscation</label>
                  <select
                    value={tcpHeaderType}
                    onChange={(e) => setTcpHeaderType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                  >
                    <option value="none">None (Standard TCP)</option>
                    <option value="http">HTTP Masquerade</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Security Protocol</label>
                <select
                  value={security}
                  onChange={(e) => setSecurity(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono uppercase"
                >
                  <option value="none">None (Plaintext)</option>
                  <option value="tls">TLS (Standard SSL / Let's Encrypt)</option>
                  <option value="reality">REALITY (Zero-Certificate Camouflage)</option>
                </select>
              </div>

              {security === 'tls' && (
                <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">SNI Domain (serverName)</label>
                      <input
                        type="text"
                        value={tlsSNI}
                        onChange={(e) => setTlsSNI(e.target.value)}
                        placeholder="e.g. sub.domain.com"
                        className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">ALPN</label>
                      <input
                        type="text"
                        value={tlsALPN}
                        onChange={(e) => setTlsALPN(e.target.value)}
                        placeholder="h2,http/1.1"
                        className="w-full px-3.5 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Min TLS Version</label>
                      <select
                        value={tlsMinVersion}
                        onChange={(e) => setTlsMinVersion(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      >
                        <option value="1.2">TLS 1.2</option>
                        <option value="1.3">TLS 1.3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Max TLS Version</label>
                      <select
                        value={tlsMaxVersion}
                        onChange={(e) => setTlsMaxVersion(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      >
                        <option value="1.3">TLS 1.3</option>
                        <option value="1.2">TLS 1.2</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {security === 'reality' && (
                <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      REALITY Camouflage Settings
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateRealityKeys}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate Keys</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Target Dest Website:Port</label>
                      <input
                        type="text"
                        value={realityDest}
                        onChange={(e) => setRealityDest(e.target.value)}
                        placeholder="www.google.com:443"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                      <div className="flex gap-1.5 mt-1.5">
                        {['www.google.com:443', 'speed.cloudflare.com:443', 'www.microsoft.com:443'].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setRealityDest(d);
                              setRealityServerNames(d.split(':')[0]);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono"
                          >
                            {d.split('.')[1]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Server Names (SNI List)</label>
                      <input
                        type="text"
                        value={realityServerNames}
                        onChange={(e) => setRealityServerNames(e.target.value)}
                        placeholder="www.google.com,google.com"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Server Private Key</label>
                      <input
                        type="text"
                        value={realityPrivKey}
                        onChange={(e) => setRealityPrivKey(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Client Public Key</label>
                      <input
                        type="text"
                        value={realityPubKey}
                        readOnly
                        className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-xs text-zinc-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Short ID</label>
                      <input
                        type="text"
                        value={realityShortId}
                        onChange={(e) => setRealityShortId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">SpiderX Path</label>
                      <input
                        type="text"
                        value={realitySpiderX}
                        onChange={(e) => setRealitySpiderX(e.target.value)}
                        placeholder="/"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ADVANCED */}
          {activeTab === 'advanced' && (
            <div className="space-y-5">
              {/* Protocol-Specific Section */}
              {protocol === 'shadowsocks' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Shadowsocks Encryption & UDP
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateShadowsocksKey}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Key</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Cipher Method</label>
                      <select
                        value={ssMethod}
                        onChange={(e) => setSsMethod(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      >
                        <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm (Fast)</option>
                        <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm (Strong)</option>
                        <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305 (ARM)</option>
                        <option value="aes-128-gcm">aes-128-gcm (AEAD)</option>
                        <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305 (AEAD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Network Modes</label>
                      <select
                        value={ssNetwork}
                        onChange={(e) => setSsNetwork(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      >
                        <option value="tcp,udp">TCP + UDP (FullCone Enabled)</option>
                        <option value="tcp">TCP Only</option>
                        <option value="udp">UDP Only</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Base64 Password / Master Key</label>
                    <input
                      type="text"
                      value={ssPassword}
                      onChange={(e) => setSsPassword(e.target.value)}
                      placeholder="Click Generate Key or enter base64 password"
                      className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {protocol === 'wireguard' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      WireGuard Server Parameters
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateWireGuardKeys}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Keypair</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Server Private Key</label>
                      <input
                        type="text"
                        value={wgSecretKey}
                        onChange={(e) => setWgSecretKey(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">MTU</label>
                      <input
                        type="number"
                        min={1280}
                        max={1500}
                        value={wgMtu}
                        onChange={(e) => setWgMtu(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {protocol === 'dokodemo-door' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Forward Address</label>
                      <input
                        type="text"
                        value={dokoAddress}
                        onChange={(e) => setDokoAddress(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Forward Port</label>
                      <input
                        type="number"
                        value={dokoPort}
                        onChange={(e) => setDokoPort(Number(e.target.value))}
                        placeholder="0 = transparent"
                        className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dokoFollowRedirect}
                      onChange={(e) => setDokoFollowRedirect(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Follow Redirect (Linux iptables REDIRECT / TPROXY)</span>
                  </label>
                </div>
              )}

              {/* Socket Options (Sockopt) */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Linux Socket Options (Sockopt)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sockoptTcpFastOpen}
                      onChange={(e) => setSockoptTcpFastOpen(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>TCP Fast Open (TFO)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sockoptAcceptProxyProtocol}
                      onChange={(e) => setSockoptAcceptProxyProtocol(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Accept PROXY Protocol (Cloudflare/Nginx)</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.04]">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">TProxy Mode</label>
                    <select
                      value={sockoptTproxy}
                      onChange={(e) => setSockoptTproxy(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                    >
                      <option value="off">Off (Standard)</option>
                      <option value="tproxy">TProxy (Transparent)</option>
                      <option value="redirect">Redirect</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">SO_MARK (Routing Mark)</label>
                    <input
                      type="number"
                      value={sockoptMark}
                      onChange={(e) => setSockoptMark(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-[#08090d] border border-white/[0.08] rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Sniffing */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    Traffic Sniffing
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sniffingEnabled}
                      onChange={(e) => setSniffingEnabled(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                {sniffingEnabled && (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {[
                      { id: 'http', label: 'HTTP', checked: sniffHttp, set: setSniffHttp },
                      { id: 'tls', label: 'TLS (SNI)', checked: sniffTls, set: setSniffTls },
                      { id: 'quic', label: 'QUIC', checked: sniffQuic, set: setSniffQuic },
                      { id: 'fakedns', label: 'FakeDNS', checked: sniffFakedns, set: setSniffFakedns },
                    ].map((item) => (
                      <label key={item.id} className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Fallbacks */}
              {(protocol === 'vless' || protocol === 'trojan') && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">Port 443 Fallbacks (JSON Array)</label>
                  <textarea
                    rows={3}
                    value={fallbacksJson}
                    onChange={(e) => setFallbacksJson(e.target.value)}
                    placeholder='[{"dest": 80, "xver": 0}]'
                    className="w-full px-3 py-2 bg-[#08090d] border border-white/[0.08] rounded-xl text-xs font-mono text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Fallback matching allows co-hosting Nginx/Caddy on port 80/8080 with zero TLS certificate fingerprint.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footer Submit Button */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-mono">
              Port Guard: {portConflict ? 'Collision Detected' : 'Clear'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(portConflict) || isSubmitting}
                className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition ${
                  portConflict
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                }`}
              >
                {isSubmitting ? 'Saving...' : inboundToEdit ? 'Update Inbound' : 'Save Inbound'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
