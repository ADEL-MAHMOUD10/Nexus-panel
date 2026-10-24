import React, { useState, useEffect } from 'react';
import { 
  X, AlertCircle, Key, RefreshCw, Shield, Zap, Sliders, Radio, Globe, Lock, 
  Cpu, Server, Tag, Hash, Database, Calendar, Check, Copy, Layers, Wifi, 
  ArrowUpRight, ArrowDownUp, Sparkles, Terminal, Activity, HelpCircle
} from 'lucide-react';
import api from '../services/api';
import { Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';

interface InboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  inboundToEdit?: Inbound | null;
}

// Protocol Meta Info
const PROTOCOLS = [
  { id: 'vless', name: 'VLESS', desc: 'Zero-overhead, lightweight & stealthy', color: 'cyan', badge: 'Recommended' },
  { id: 'trojan', name: 'Trojan', desc: 'HTTPS mimicry with TLS/REALITY', color: 'amber', badge: 'Stealth' },
  { id: 'vmess', name: 'VMess', desc: 'Encrypted AEAD signature protocol', color: 'purple', badge: 'Legacy' },
  { id: 'shadowsocks', name: 'Shadowsocks', desc: '2022 Blake3 ciphers & Full UDP', color: 'emerald', badge: 'Fast UDP' },
  { id: 'wireguard', name: 'WireGuard', desc: 'Kernel / Go-tun native UDP tunnel', color: 'blue', badge: 'Native UDP' },
  { id: 'hysteria', name: 'Hysteria 2', desc: 'QUIC UDP for high packet-loss links', color: 'rose', badge: 'High Speed' },
  { id: 'dokodemo-door', name: 'Dokodemo', desc: 'Port forward & transparent TProxy', color: 'indigo', badge: 'Tunnel' },
  { id: 'socks', name: 'SOCKS5', desc: 'Standard SOCKS5 with UDP relay', color: 'zinc', badge: 'Proxy' },
  { id: 'http', name: 'HTTP', desc: 'Standard HTTP/HTTPS proxy tunnel', color: 'zinc', badge: 'Proxy' },
];

// Transport Meta Info
const TRANSPORTS = [
  { id: 'tcp', name: 'TCP (Raw)', desc: 'Standard direct stream with optional HTTP header', icon: Wifi },
  { id: 'ws', name: 'WebSocket', desc: 'CDN-ready with 0-RTT early data support', icon: Globe },
  { id: 'grpc', name: 'gRPC', desc: 'HTTP/2 multiplexed streams via Gun / MultiMode', icon: Layers },
  { id: 'httpupgrade', name: 'HTTPUpgrade', desc: 'Lightweight modern HTTP/1.1 upgrade stream', icon: ArrowDownUp },
  { id: 'splithttp', name: 'SplitHTTP (XHTTP)', desc: 'Next-gen CDN transport with independent streams', icon: Zap },
  { id: 'kcp', name: 'mKCP (UDP)', desc: 'High-speed UDP stream with protocol camouflage', icon: Radio },
];

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
  const [security, setSecurity] = useState('reality'); // none, tls, reality
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

  // Find next free port
  const handlePickNextAvailablePort = async () => {
    const commonPorts = [2053, 2083, 2087, 2096, 8443, 8080, 443, 10443, 20443];
    let candidate = port + 1;
    if (candidate > 65000) candidate = 2053;
    
    // Check candidates
    for (let p of [candidate, ...commonPorts]) {
      try {
        const query = new URLSearchParams({
          port: p.toString(),
          protocol,
          streamSettings: JSON.stringify({ network }),
          listen,
          ignoreId: inboundToEdit ? inboundToEdit.id.toString() : '0',
        });
        const res = await api.get(`/api/inbounds/check-port?${query.toString()}`);
        if (res.data && res.data.available) {
          setPort(p);
          notify.success('Port Assigned', `Found available port ${p}`);
          return;
        }
      } catch (e) {}
    }
    setPort(candidate);
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Modal Dialog Window */}
      <div className="bg-[#0b0c14] border border-white/[0.12] rounded-3xl w-full max-w-3xl shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col my-auto max-h-[94vh] relative">
        
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Header Bar */}
        <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-[#080910]/80 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {inboundToEdit ? 'Edit Inbound Listener' : 'Create Inbound Listener'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {protocol}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                <span className="text-zinc-500">Port {port}</span>
                <span>•</span>
                <span className="text-zinc-400 uppercase">{network}</span>
                <span>•</span>
                <span className={security === 'reality' ? 'text-emerald-400 font-semibold' : security === 'tls' ? 'text-cyan-400' : 'text-zinc-500'}>
                  {security.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition border border-transparent hover:border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Pill Tabs Navigation */}
        <div className="p-2 bg-[#080910] border-b border-white/[0.06] relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/[0.04]">
            {[
              { id: 'basics', label: '1. Basics & Port', icon: Server, color: 'cyan' },
              { id: 'transport', label: '2. Transport & UDP', icon: Radio, color: 'blue' },
              { id: 'security', label: '3. Security & TLS', icon: Shield, color: 'emerald' },
              { id: 'advanced', label: '4. Advanced Tuning', icon: Sliders, color: 'purple' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 border ${
                    isActive
                      ? 'bg-gradient-to-r from-white/[0.12] to-white/[0.06] text-white border-white/[0.2] shadow-lg shadow-black/40 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 relative z-10">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono flex items-center gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: BASICS & PORT */}
          {activeTab === 'basics' && (
            <div className="space-y-5">
              
              {/* Field 1: Inbound Remark with Styled UI Label */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Tag className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Inbound Remark & Label
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-400">
                    Friendly Identifier
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="e.g. VLESS-REALITY-Port443"
                    className="w-full px-4 py-2.5 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20 font-mono transition"
                  />
                </div>
              </div>

              {/* Protocol Visual Selector */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Layers className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Proxy Protocol Architecture
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                    {protocol.toUpperCase()}
                  </span>
                </div>
                
                {/* Protocol Grid Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROTOCOLS.map((p) => {
                    const isSelected = protocol === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProtocol(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40'
                            : 'bg-[#07080e] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold font-mono ${isSelected ? 'text-cyan-300' : 'text-zinc-200'}`}>
                            {p.name}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center text-black">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight line-clamp-1">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field 2 & 3: Port with Guard & Listen IP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Port Section with Intelligent Collision Guard UI */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Hash className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Listening Port
                      </label>
                    </div>
                    {isCheckingPort ? (
                      <span className="text-[10px] text-cyan-400 font-mono animate-pulse">Scanning...</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        portConflict 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {portConflict ? 'Conflict' : 'Port Free'}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={65535}
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className={`w-full px-4 py-2.5 bg-[#07080e] border rounded-xl text-xs font-mono text-white focus:outline-none transition ${
                        portConflict 
                          ? 'border-rose-500/80 bg-rose-500/10 text-rose-200 ring-2 ring-rose-500/20' 
                          : 'border-white/[0.1] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20'
                      }`}
                    />
                  </div>

                  {/* Quick Preset Port Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[443, 8443, 2053, 2083, 2087, 2096].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPort(p)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-mono transition border ${
                          port === p
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handlePickNextAvailablePort}
                      className="text-[10px] px-2 py-1 rounded-lg font-mono bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Suggest Free</span>
                    </button>
                  </div>

                  {/* Port Conflict Alert UI */}
                  {portConflict && (
                    <div className="mt-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-200 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{portConflict}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handlePickNextAvailablePort}
                        className="self-start px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/40 text-[10px] font-semibold text-white flex items-center gap-1 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Assign Next Free Port Automatically</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Listen IP with styled UI Label */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <Globe className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Listening Interface IP
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-400">
                      Bind Socket
                    </span>
                  </div>
                  <input
                    type="text"
                    value={listen}
                    onChange={(e) => setListen(e.target.value)}
                    placeholder="0.0.0.0"
                    className="w-full px-4 py-2.5 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-400/60 transition"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {['0.0.0.0', '127.0.0.1', '::'].map((ip) => (
                      <button
                        key={ip}
                        type="button"
                        onClick={() => setListen(ip)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-mono transition border ${
                          listen === ip
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {ip === '0.0.0.0' ? 'All (0.0.0.0)' : ip === '127.0.0.1' ? 'Local Only' : 'IPv6 (::)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Traffic Quota & Expiry Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Traffic Quota */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Database className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Total Inbound Quota (GB)
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-400">
                      {totalGB === 0 ? 'Unlimited' : `${totalGB} GB`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={totalGB}
                    onChange={(e) => setTotalGB(Number(e.target.value))}
                    placeholder="0 = Unlimited"
                    className="w-full px-4 py-2.5 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-400/60 transition"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[0, 50, 100, 500, 1000].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setTotalGB(q)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-mono transition border ${
                          totalGB === q
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {q === 0 ? 'Unlimited' : `${q}GB`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiry Time */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                        <Calendar className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Lifespan Duration (Days)
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-400">
                      {expiryDays === 0 ? 'No Expiry' : `${expiryDays} Days`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    placeholder="0 = Never expires"
                    className="w-full px-4 py-2.5 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-400/60 transition"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[0, 30, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setExpiryDays(d)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-mono transition border ${
                          expiryDays === d
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {d === 0 ? 'Forever' : `${d}d`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSPORT & UDP STREAM */}
          {activeTab === 'transport' && (
            <div className="space-y-5">
              
              {/* Transport Network Selector Grid */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Radio className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Network Stream Transport Layer
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                    {network.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {TRANSPORTS.map((t) => {
                    const isSelected = network === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNetwork(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40'
                            : 'bg-[#07080e] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-zinc-500'}`} />
                            <span className={`text-xs font-bold font-mono ${isSelected ? 'text-cyan-300' : 'text-zinc-200'}`}>
                              {t.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 flex items-center justify-center text-black">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Transport Sub-Panels with Rich Label UI */}

              {/* WebSocket Config */}
              {network === 'ws' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">WebSocket Inbound Options</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">WS Path</label>
                      <input
                        type="text"
                        value={wsPath}
                        onChange={(e) => setWsPath(e.target.value)}
                        placeholder="/vless-ws"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">WS Host Header</label>
                      <input
                        type="text"
                        value={wsHost}
                        onChange={(e) => setWsHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* gRPC Config */}
              {network === 'grpc' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">gRPC Tunneling Options</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">gRPC Service Name</label>
                    <input
                      type="text"
                      value={grpcServiceName}
                      onChange={(e) => setGrpcServiceName(e.target.value)}
                      placeholder="vless-grpc"
                      className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={grpcMultiMode}
                      onChange={(e) => setGrpcMultiMode(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Enable MultiMode (Gun architecture multiplexing)</span>
                  </label>
                </div>
              )}

              {/* HTTPUpgrade Config */}
              {network === 'httpupgrade' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
                    <ArrowDownUp className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">HTTPUpgrade Options</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Path</label>
                      <input
                        type="text"
                        value={httpUpgradePath}
                        onChange={(e) => setHttpUpgradePath(e.target.value)}
                        placeholder="/httpupgrade"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Host Header</label>
                      <input
                        type="text"
                        value={httpUpgradeHost}
                        onChange={(e) => setHttpUpgradeHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SplitHTTP / XHTTP Config */}
              {(network === 'splithttp' || network === 'xhttp') && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">SplitHTTP / XHTTP Next-Gen Stream</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      Modern CDN
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">XHTTP Path</label>
                      <input
                        type="text"
                        value={splitHttpPath}
                        onChange={(e) => setSplitHttpPath(e.target.value)}
                        placeholder="/xhttp"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Host Header</label>
                      <input
                        type="text"
                        value={splitHttpHost}
                        onChange={(e) => setSplitHttpHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Transmission Mode</label>
                    <select
                      value={splitHttpMode}
                      onChange={(e) => setSplitHttpMode(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                    >
                      <option value="stream-up">stream-up (Continuous upload streaming - Recommended)</option>
                      <option value="stream-one">stream-one (Bidirectional single stream)</option>
                      <option value="packet-up">packet-up (Packet chunked uplink)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* mKCP UDP Config */}
              {network === 'kcp' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">mKCP High-Speed UDP Configuration</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      BBR Accelerated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Header Masquerade Camouflage</label>
                      <select
                        value={kcpHeaderType}
                        onChange={(e) => setKcpHeaderType(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      >
                        <option value="none">None (Raw KCP)</option>
                        <option value="srtp">SRTP (Video Call Camouflage)</option>
                        <option value="utp">uTP (BitTorrent Camouflage)</option>
                        <option value="wechat-video">WeChat Video Call</option>
                        <option value="dtls">DTLS 1.2 Handshake</option>
                        <option value="wireguard">WireGuard UDP Camouflage</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Obfuscation Seed</label>
                      <input
                        type="text"
                        value={kcpSeed}
                        onChange={(e) => setKcpSeed(e.target.value)}
                        placeholder="Optional traffic scrambling seed"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
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
                        className="w-full px-3 py-1.5 bg-[#07080e] border border-white/[0.1] rounded-lg text-xs text-white font-mono"
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
                        className="w-full px-3 py-1.5 bg-[#07080e] border border-white/[0.1] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Uplink Cap (MB/s)</label>
                      <input
                        type="number"
                        min={1}
                        value={kcpUpCap}
                        onChange={(e) => setKcpUpCap(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#07080e] border border-white/[0.1] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Downlink Cap (MB/s)</label>
                      <input
                        type="number"
                        min={1}
                        value={kcpDownCap}
                        onChange={(e) => setKcpDownCap(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#07080e] border border-white/[0.1] rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={kcpCongestion}
                      onChange={(e) => setKcpCongestion(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-emerald-500 focus:ring-0"
                    />
                    <span>Enable Congestion Control (Smooth throughput & drop resistance)</span>
                  </label>
                </div>
              )}

              {/* TCP Header */}
              {network === 'tcp' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    TCP Header Obfuscation
                  </label>
                  <select
                    value={tcpHeaderType}
                    onChange={(e) => setTcpHeaderType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                  >
                    <option value="none">None (Direct standard TCP stream)</option>
                    <option value="http">HTTP Masquerade (Simulates HTTP GET/POST)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SECURITY (REALITY / TLS) */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              
              {/* Security Protocol Cards */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Shield className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Security & Encryption Layer
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    {security.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'reality', title: 'REALITY', desc: 'Zero-Cert TLS Camouflage', icon: Shield, badge: 'Recommended' },
                    { id: 'tls', title: 'TLS 1.3', desc: 'Standard SSL / Let\'s Encrypt', icon: Lock, badge: 'Standard' },
                    { id: 'none', title: 'None', desc: 'Plaintext (Internal / CDN WS)', icon: Globe, badge: 'Plain' },
                  ].map((s) => {
                    const isSelected = security === s.id;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSecurity(s.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40'
                            : 'bg-[#07080e] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                            <span className={`text-xs font-bold font-mono ${isSelected ? 'text-emerald-300' : 'text-zinc-200'}`}>
                              {s.title}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">{s.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* REALITY Settings Card */}
              {security === 'reality' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        REALITY Handshake Camouflage Parameters
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateRealityKeys}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate Keypair</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Target Destination (dest)</label>
                      <input
                        type="text"
                        value={realityDest}
                        onChange={(e) => setRealityDest(e.target.value)}
                        placeholder="www.google.com:443"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-emerald-400/60 focus:outline-none"
                      />
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { name: 'Google', dest: 'www.google.com:443', sni: 'www.google.com' },
                          { name: 'Cloudflare', dest: 'speed.cloudflare.com:443', sni: 'speed.cloudflare.com' },
                          { name: 'Microsoft', dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
                          { name: 'Apple', dest: 'www.apple.com:443', sni: 'www.apple.com' },
                          { name: 'Yahoo', dest: 'www.yahoo.com:443', sni: 'www.yahoo.com' },
                        ].map((d) => (
                          <button
                            key={d.name}
                            type="button"
                            onClick={() => {
                              setRealityDest(d.dest);
                              setRealityServerNames(d.sni);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white font-mono border border-white/[0.04] transition"
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Server Names (SNI List)</label>
                      <input
                        type="text"
                        value={realityServerNames}
                        onChange={(e) => setRealityServerNames(e.target.value)}
                        placeholder="www.google.com,google.com"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-emerald-400/60 focus:outline-none"
                      />
                      <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                        Comma-separated domain list matching dest target
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Server Private Key (x25519)</label>
                      <input
                        type="text"
                        value={realityPrivKey}
                        onChange={(e) => setRealityPrivKey(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-emerald-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Client Public Key (x25519)</label>
                      <input
                        type="text"
                        value={realityPubKey}
                        readOnly
                        className="w-full px-3.5 py-2 bg-black/40 border border-white/[0.06] rounded-xl text-xs text-emerald-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Short ID</label>
                      <input
                        type="text"
                        value={realityShortId}
                        onChange={(e) => setRealityShortId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-emerald-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">SpiderX Path</label>
                      <input
                        type="text"
                        value={realitySpiderX}
                        onChange={(e) => setRealitySpiderX(e.target.value)}
                        placeholder="/"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-emerald-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TLS Settings Card */}
              {security === 'tls' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">TLS Configuration</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">SNI Domain (serverName)</label>
                      <input
                        type="text"
                        value={tlsSNI}
                        onChange={(e) => setTlsSNI(e.target.value)}
                        placeholder="e.g. proxy.domain.com"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">ALPN</label>
                      <input
                        type="text"
                        value={tlsALPN}
                        onChange={(e) => setTlsALPN(e.target.value)}
                        placeholder="h2,http/1.1"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Min TLS Version</label>
                      <select
                        value={tlsMinVersion}
                        onChange={(e) => setTlsMinVersion(e.target.value)}
                        className="w-full px-3 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
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
                        className="w-full px-3 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono"
                      >
                        <option value="1.3">TLS 1.3</option>
                        <option value="1.2">TLS 1.2</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ADVANCED TUNING & SOCKOPT */}
          {activeTab === 'advanced' && (
            <div className="space-y-5">
              
              {/* Protocol Specific Card (Shadowsocks / WireGuard / Hysteria) */}
              {protocol === 'shadowsocks' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Shadowsocks 2022 & FullCone UDP
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateShadowsocksKey}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Key</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Encryption Cipher</label>
                      <select
                        value={ssMethod}
                        onChange={(e) => setSsMethod(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      >
                        <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm (Fast Standard)</option>
                        <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm (High Security)</option>
                        <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305 (ARM/Mobile)</option>
                        <option value="aes-128-gcm">aes-128-gcm (Legacy AEAD)</option>
                        <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305 (Legacy AEAD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Network Modes</label>
                      <select
                        value={ssNetwork}
                        onChange={(e) => setSsNetwork(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      >
                        <option value="tcp,udp">TCP + UDP (FullCone Relay)</option>
                        <option value="tcp">TCP Only</option>
                        <option value="udp">UDP Only</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Master Base64 Password Key</label>
                    <input
                      type="text"
                      value={ssPassword}
                      onChange={(e) => setSsPassword(e.target.value)}
                      placeholder="Click Generate Key or enter base64 key"
                      className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {protocol === 'wireguard' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        WireGuard Kernel/Go-Tun Tunnel
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateWireGuardKeys}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Keypair</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Server Private Key (Base64)</label>
                      <input
                        type="text"
                        value={wgSecretKey}
                        onChange={(e) => setWgSecretKey(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Inner MTU</label>
                      <input
                        type="number"
                        min={1280}
                        max={1500}
                        value={wgMtu}
                        onChange={(e) => setWgMtu(Number(e.target.value))}
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {protocol === 'dokodemo-door' && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
                    <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Dokodemo-door Forwarding Target
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Destination IP / Host</label>
                      <input
                        type="text"
                        value={dokoAddress}
                        onChange={(e) => setDokoAddress(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Destination Port</label>
                      <input
                        type="number"
                        value={dokoPort}
                        onChange={(e) => setDokoPort(Number(e.target.value))}
                        placeholder="0 = Transparent"
                        className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={dokoFollowRedirect}
                      onChange={(e) => setDokoFollowRedirect(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-indigo-500 focus:ring-0"
                    />
                    <span>Follow Redirect (Accept Linux iptables/nftables TPROXY & REDIRECT)</span>
                  </label>
                </div>
              )}

              {/* Linux Socket Options (Sockopt) with Rich UI */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Cpu className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Linux Socket Performance Options (Sockopt)
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                    Kernel Level
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3 rounded-xl bg-[#07080e] border border-white/[0.06] flex items-center justify-between cursor-pointer hover:border-white/10 transition">
                    <div>
                      <span className="text-xs font-semibold text-white block">TCP Fast Open (TFO)</span>
                      <span className="text-[10px] text-zinc-500">0-RTT data in SYN packet</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={sockoptTcpFastOpen}
                      onChange={(e) => setSockoptTcpFastOpen(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0 w-4 h-4"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-[#07080e] border border-white/[0.06] flex items-center justify-between cursor-pointer hover:border-white/10 transition">
                    <div>
                      <span className="text-xs font-semibold text-white block">Accept PROXY Protocol</span>
                      <span className="text-[10px] text-zinc-500">Real Client IP from Cloudflare/Nginx</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={sockoptAcceptProxyProtocol}
                      onChange={(e) => setSockoptAcceptProxyProtocol(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">TProxy Mode</label>
                    <select
                      value={sockoptTproxy}
                      onChange={(e) => setSockoptTproxy(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                    >
                      <option value="off">Off (Standard Socket)</option>
                      <option value="tproxy">TProxy (Transparent Proxying)</option>
                      <option value="redirect">Redirect (iptables REDIRECT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">SO_MARK (Routing Mark)</label>
                    <input
                      type="number"
                      value={sockoptMark}
                      onChange={(e) => setSockoptMark(Number(e.target.value))}
                      placeholder="0 = None"
                      className="w-full px-3.5 py-2 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs text-white font-mono focus:border-cyan-400/60 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Traffic Sniffing with Micro-Badges */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Globe className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Real-time Traffic Sniffing
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-cyan-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sniffingEnabled}
                      onChange={(e) => setSniffingEnabled(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span className="font-semibold">Active</span>
                  </label>
                </div>

                {sniffingEnabled && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'http', label: 'HTTP Domain', checked: sniffHttp, set: setSniffHttp },
                      { id: 'tls', label: 'TLS (SNI)', checked: sniffTls, set: setSniffTls },
                      { id: 'quic', label: 'QUIC Domain', checked: sniffQuic, set: setSniffQuic },
                      { id: 'fakedns', label: 'FakeDNS IP', checked: sniffFakedns, set: setSniffFakedns },
                    ].map((item) => (
                      <label 
                        key={item.id} 
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          item.checked 
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-white' 
                            : 'bg-[#07080e] border-white/[0.06] text-zinc-500'
                        }`}
                      >
                        <span className="text-xs font-mono font-medium">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Port 443 Fallbacks */}
              {(protocol === 'vless' || protocol === 'trojan') && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Port 443 Multi-Fallback Rules
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Nginx/Caddy Coexistence</span>
                  </div>
                  <textarea
                    rows={3}
                    value={fallbacksJson}
                    onChange={(e) => setFallbacksJson(e.target.value)}
                    placeholder='[{"dest": 80, "xver": 0}]'
                    className="w-full px-3.5 py-2.5 bg-[#07080e] border border-white/[0.1] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400/60"
                  />
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Routes non-proxy traffic to local web servers seamlessly without triggering active DPI probes.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer with Status Indicator & Submit Action */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between relative z-10 bg-[#0b0c14]">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${portConflict ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className={`text-xs font-mono font-medium ${portConflict ? 'text-rose-400' : 'text-zinc-400'}`}>
                {portConflict ? 'Port Conflict' : 'Port Ready'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition border border-transparent hover:border-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(portConflict) || isSubmitting}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-xl transition flex items-center gap-2 ${
                  portConflict
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.4)]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Inbound...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{inboundToEdit ? 'Update Inbound' : 'Create Inbound'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
