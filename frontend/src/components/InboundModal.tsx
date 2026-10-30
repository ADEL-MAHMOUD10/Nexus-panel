import React, { useState, useEffect, useRef } from 'react';
import { 
  X, AlertCircle, Key, RefreshCw, Shield, Zap, Sliders, Radio, Globe, Lock, 
  Cpu, Server, Tag, Hash, Database, Calendar, Check, Copy, Layers, Wifi, 
  ArrowUpRight, ArrowDownUp, Sparkles, Terminal, Activity, HelpCircle
} from 'lucide-react';
import api from '../services/api';
import { Inbound } from '../types';
import { useNotification } from '../context/NotificationContext';
import { copyToClipboard } from '../utils/clipboard';

interface InboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  inboundToEdit?: Inbound | null;
  existingInbounds?: Inbound[];
}

export interface ProtocolDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  badge: string;
  supportedSecurities: ('none' | 'tls' | 'reality')[];
  unsupportedSecuritiesText: string;
  defaultSecurity: 'none' | 'tls' | 'reality';
  supportedTransports: ('tcp' | 'ws' | 'grpc' | 'httpupgrade' | 'splithttp' | 'kcp')[];
  unsupportedTransportsText: string;
  defaultTransport: 'tcp' | 'ws' | 'grpc' | 'httpupgrade' | 'splithttp' | 'kcp';
  isFixedTransport?: boolean;
  fixedTransportName?: string;
  fixedTransportDesc?: string;
  isFixedSecurity?: boolean;
  fixedSecurityName?: string;
  fixedSecurityDesc?: string;
  securitySummary: string;
  transportSummary: string;
}

// Protocol Meta Info with Strict Architecture & Capabilities Matrix
const PROTOCOLS: ProtocolDef[] = [
  {
    id: 'vless',
    name: 'VLESS',
    desc: 'Zero-overhead, lightweight & stealthy',
    color: 'blue',
    badge: 'Recommended',
    supportedSecurities: ['reality', 'tls', 'none'],
    unsupportedSecuritiesText: 'All major stream security layers supported.',
    defaultSecurity: 'none',
    supportedTransports: ['tcp', 'ws', 'grpc', 'httpupgrade', 'splithttp', 'kcp'],
    unsupportedTransportsText: 'Note: XTLS-Vision flow is strictly restricted to TCP + TLS/REALITY.',
    defaultTransport: 'tcp',
    securitySummary: 'REALITY • TLS • None',
    transportSummary: 'TCP • WS • gRPC • XHTTP',
  },
  {
    id: 'trojan',
    name: 'Trojan',
    desc: 'HTTPS mimicry with TLS/REALITY',
    color: 'amber',
    badge: 'Stealth',
    supportedSecurities: ['tls', 'reality', 'none'],
    unsupportedSecuritiesText: 'Does NOT support XTLS-Vision (Vision flow is exclusive to VLESS).',
    defaultSecurity: 'none',
    supportedTransports: ['tcp', 'ws', 'grpc', 'httpupgrade', 'splithttp'],
    unsupportedTransportsText: 'mKCP is unsupported with Trojan TLS/REALITY handshakes.',
    defaultTransport: 'tcp',
    securitySummary: 'TLS • REALITY • None',
    transportSummary: 'TCP • WS • gRPC • XHTTP',
  },
  {
    id: 'vmess',
    name: 'VMess',
    desc: 'Encrypted AEAD signature protocol',
    color: 'purple',
    badge: 'Legacy',
    supportedSecurities: ['none', 'tls'],
    unsupportedSecuritiesText: 'Does NOT support REALITY (VMess AEAD signature interferes with TLS 1.3 REALITY spoofing).',
    defaultSecurity: 'none',
    supportedTransports: ['ws', 'tcp', 'grpc', 'httpupgrade', 'splithttp', 'kcp'],
    unsupportedTransportsText: 'All standard stream transports supported.',
    defaultTransport: 'ws',
    securitySummary: 'None (AEAD) • TLS',
    transportSummary: 'WS • TCP • gRPC • mKCP',
  },
  {
    id: 'shadowsocks',
    name: 'Shadowsocks',
    desc: '2022 Blake3 ciphers & Full UDP',
    color: 'emerald',
    badge: 'Fast UDP',
    supportedSecurities: ['none'],
    unsupportedSecuritiesText: 'Outer TLS and REALITY stream wrapping are NOT supported for Shadowsocks in Xray.',
    defaultSecurity: 'none',
    isFixedSecurity: true,
    fixedSecurityName: 'Shadowsocks 2022 AEAD Cryptography',
    fixedSecurityDesc: 'Shadowsocks encrypts all packets end-to-end using BLAKE3 or AEAD ciphers (2022-blake3-aes-128-gcm / chacha20-poly1305). External TLS/REALITY stream wrapping is not supported for standard Shadowsocks.',
    supportedTransports: ['tcp'],
    unsupportedTransportsText: 'Web transports (WebSocket, gRPC, SplitHTTP) are not supported by standard Shadowsocks clients.',
    defaultTransport: 'tcp',
    isFixedTransport: true,
    fixedTransportName: 'Layer 4 TCP & FullCone UDP Sockets',
    fixedTransportDesc: 'Shadowsocks communicates directly over raw Layer 4 sockets with Full-Cone NAT traversal. Web-layer stream transports are not supported by standard Shadowsocks inbounds.',
    securitySummary: 'Built-in 2022 AEAD',
    transportSummary: 'L4 TCP / UDP Only',
  },
  {
    id: 'wireguard',
    name: 'WireGuard',
    desc: 'Kernel / Go-tun native UDP tunnel',
    color: 'blue',
    badge: 'Native UDP',
    supportedSecurities: ['none'],
    unsupportedSecuritiesText: 'Web stream security (TLS / REALITY) is NOT applicable to WireGuard.',
    defaultSecurity: 'none',
    isFixedSecurity: true,
    fixedSecurityName: 'WireGuard Noise_IK Protocol (Curve25519)',
    fixedSecurityDesc: 'WireGuard utilizes internal asymmetric Curve25519 keys with the Noise_IK handshake. External TLS and REALITY layers are not applicable.',
    supportedTransports: ['tcp'],
    unsupportedTransportsText: 'WireGuard strictly rejects TCP, WebSocket, gRPC, and HTTP. Only raw UDP is permitted.',
    defaultTransport: 'tcp',
    isFixedTransport: true,
    fixedTransportName: 'Native WireGuard UDP Tunnel (Go-Tun)',
    fixedTransportDesc: 'WireGuard operates exclusively over UDP datagram packets. Stream transports (TCP, WebSocket, gRPC) are not supported.',
    securitySummary: 'Noise Protocol (Curve25519)',
    transportSummary: 'UDP Datagrams Only',
  },
  {
    id: 'hysteria',
    name: 'Hysteria 2',
    desc: 'QUIC UDP for high packet-loss links',
    color: 'rose',
    badge: 'High Speed',
    supportedSecurities: ['tls'],
    unsupportedSecuritiesText: 'Plaintext (None) and REALITY are strictly NOT supported. The QUIC protocol standard mandates TLS encryption.',
    defaultSecurity: 'tls',
    isFixedSecurity: false,
    supportedTransports: ['tcp'],
    unsupportedTransportsText: 'Operates exclusively over custom QUIC (UDP). Stream transports (TCP, WebSocket, gRPC) are not supported.',
    defaultTransport: 'tcp',
    isFixedTransport: true,
    fixedTransportName: 'Custom QUIC UDP with Brutal CC',
    fixedTransportDesc: 'Hysteria 2 operates exclusively over QUIC UDP packets with Brutal congestion control and Salamander packet padding to bypass throttling. Stream transports (TCP, WS, gRPC) are not supported.',
    securitySummary: 'TLS (Mandatory by QUIC)',
    transportSummary: 'QUIC UDP Only',
  },
  {
    id: 'dokodemo-door',
    name: 'Dokodemo',
    desc: 'Port forward & transparent TProxy',
    color: 'indigo',
    badge: 'Tunnel',
    supportedSecurities: ['none'],
    unsupportedSecuritiesText: 'Dokodemo-door passes raw network packets through without terminating TLS or REALITY.',
    defaultSecurity: 'none',
    isFixedSecurity: true,
    fixedSecurityName: 'Raw Passthrough (No Stream Security)',
    fixedSecurityDesc: 'Dokodemo-door is a transparent port-forwarding and TProxy redirector. It forwards raw network packets to the destination without terminating TLS or REALITY.',
    supportedTransports: ['tcp'],
    unsupportedTransportsText: 'Web stream transports (WS, gRPC, SplitHTTP) are not applicable to raw port forwarders.',
    defaultTransport: 'tcp',
    isFixedTransport: true,
    fixedTransportName: 'Direct Layer 4 Port Forwarder',
    fixedTransportDesc: 'Dokodemo-door operates directly over Layer 4 TCP or UDP sockets. Stream transports (WS, gRPC, SplitHTTP) are not applicable.',
    securitySummary: 'Raw Passthrough',
    transportSummary: 'TCP / UDP Forwarder',
  },
  {
    id: 'socks',
    name: 'SOCKS5',
    desc: 'Standard SOCKS5 with UDP relay',
    color: 'zinc',
    badge: 'Proxy',
    supportedSecurities: ['none'],
    unsupportedSecuritiesText: 'Standard SOCKS5 clients do not support REALITY or TLS stream wrapping.',
    defaultSecurity: 'none',
    isFixedSecurity: true,
    fixedSecurityName: 'RFC 1928 SOCKS5 Protocol',
    fixedSecurityDesc: 'Standard SOCKS5 with optional username/password authentication. Standard SOCKS clients (browsers, Telegram, cURL) connect directly without outer TLS / REALITY.',
    supportedTransports: ['tcp'],
    unsupportedTransportsText: 'Web stream transports (WS, gRPC, SplitHTTP) are not supported by standard SOCKS clients.',
    defaultTransport: 'tcp',
    isFixedTransport: true,
    fixedTransportName: 'Standard TCP & UDP Associate Relay',
    fixedTransportDesc: 'Standard SOCKS5 operates over raw TCP with UDP ASSOCIATE relay. Web-based stream transports (WS, gRPC, SplitHTTP) are not supported by standard SOCKS clients.',
    securitySummary: 'RFC 1928 Plain / Auth',
    transportSummary: 'TCP / UDP Associate',
  },
  {
    id: 'http',
    name: 'HTTP',
    desc: 'Standard HTTP/HTTPS proxy tunnel',
    color: 'zinc',
    badge: 'Proxy',
    supportedSecurities: ['none', 'tls'],
    unsupportedSecuritiesText: 'Does NOT support REALITY (Standard HTTP proxy uses plaintext or HTTPS TLS tunnel).',
    defaultSecurity: 'none',
    isFixedSecurity: false,
    supportedTransports: ['tcp'],
    unsupportedTransportsText: 'Standard HTTP proxy clients operate exclusively over TCP streams.',
    defaultTransport: 'tcp',
    isFixedTransport: true,
    fixedTransportName: 'Standard RFC 7230 HTTP / HTTPS Tunnel',
    fixedTransportDesc: 'Standard HTTP proxy operates over TCP streams. Web-based transports like WebSocket, gRPC, or mKCP are not supported by standard HTTP proxy clients.',
    securitySummary: 'None (Plain) • TLS (HTTPS)',
    transportSummary: 'TCP Stream Only',
  },
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

const getSuggestedRemark = (proto: string, sec: string, p: number) => {
  const pStr = p && p > 0 ? String(p) : 'custom';
  switch ((proto || 'vless').toLowerCase()) {
    case 'shadowsocks':
      return `SS-2022-${pStr}`;
    case 'trojan':
      return sec === 'reality' ? `Trojan-REALITY-${pStr}` : `Trojan-${pStr}`;
    case 'vmess':
      return `VMess-${pStr}`;
    case 'wireguard':
      return `WG-${pStr}`;
    case 'hysteria':
    case 'hysteria2':
      return `HY2-${pStr}`;
    case 'dokodemo-door':
      return `Doko-${pStr}`;
    case 'socks':
      return `Socks5-${pStr}`;
    case 'http':
      return `HTTP-${pStr}`;
    case 'vless':
    default:
      return sec === 'reality' ? `VLESS-REALITY-${pStr}` : `VLESS-${pStr}`;
  }
};

export const InboundModal: React.FC<InboundModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  inboundToEdit,
  existingInbounds,
}) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'basics' | 'transport' | 'security' | 'advanced'>('basics');
  const prevIsOpenRef = useRef(false);
  
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  // 1. Basics Form
  const [remark, setRemark] = useState('');
  const [isRemarkCustom, setIsRemarkCustom] = useState(false);
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

  // 3. Security (None / TLS / REALITY)
  const [security, setSecurity] = useState('none'); // none, tls, reality
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

  // Real-time Port Collision & Firewall Detection state
  const [portConflict, setPortConflict] = useState<string | null>(null);
  const [portOccupiedBy, setPortOccupiedBy] = useState<string | null>(null);
  const [firewallInfo, setFirewallInfo] = useState<{
    engine: string;
    status: string;
    isOpen: boolean;
    details: string;
    command?: string;
  } | null>(null);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Populate data when opening modal or editing
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!isOpen) return;

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

    } else if (justOpened) {
      // New Inbound defaults - runs ONCE when modal is opened!
      setIsRemarkCustom(false);

      // Auto-assign the next genuinely free port based on existing inbounds
      const occupiedPorts = new Set(
        (existingInbounds || [])
          .map((i) => Number(i.port))
          .filter((p) => !isNaN(p) && p > 0)
      );

      let initialPort = 2053;
      while (occupiedPorts.has(initialPort) && initialPort < 65535) {
        initialPort++;
      }

      setPort(initialPort);
      setListen('0.0.0.0');
      setProtocol('vless');
      setNetwork('tcp');
      setSecurity('none');
      setRemark(getSuggestedRemark('vless', 'none', initialPort));
      setPortConflict(null);
      setPortOccupiedBy(null);
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
        if (res.data) {
          if (!res.data.available) {
            setPortConflict(res.data.message || `Port ${port} is not available.`);
            setPortOccupiedBy(res.data.occupiedBy || null);
          } else {
            setPortConflict(null);
            setPortOccupiedBy(null);
          }
          if (res.data.firewall) {
            setFirewallInfo(res.data.firewall);
          }
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

  const handleSelectProtocol = (protoId: string) => {
    const protoDef = PROTOCOLS.find((p) => p.id === protoId) || PROTOCOLS[0];
    setProtocol(protoId);

    // 1. Auto-heal Security
    let nextSec = security as 'none' | 'tls' | 'reality';
    if (!protoDef.supportedSecurities.includes(nextSec)) {
      nextSec = protoDef.defaultSecurity;
      setSecurity(nextSec);
    }

    // 2. Auto-heal Transport
    let nextNet = network;
    if (protoDef.isFixedTransport) {
      nextNet = protoDef.defaultTransport;
      setNetwork(nextNet);
    } else {
      const validTransports = protoDef.supportedTransports.filter((t) => {
        if (nextSec === 'reality') {
          return t === 'tcp' || t === 'splithttp' || t === 'grpc';
        }
        return true;
      });
      if (!validTransports.includes(network as any)) {
        nextNet = validTransports[0] || protoDef.defaultTransport;
        setNetwork(nextNet);
      }
    }

    // Protocol-specific key generation
    if (protoId === 'shadowsocks') {
      if (!ssPassword) {
        handleGenerateShadowsocksKey();
      }
    } else if (protoId === 'wireguard') {
      if (!wgSecretKey) {
        handleGenerateWireGuardKeys();
      }
    } else if (protoId === 'vless' || protoId === 'trojan') {
      if (nextSec === 'reality' && !realityPrivKey) {
        handleGenerateRealityKeys();
      }
    }

    const isAutoRemark = !isRemarkCustom || !remark || 
      /^(VLESS|Trojan|SS-2022|VMess|WG|HY2|Doko|Socks5|HTTP)/i.test(remark);
    if (isAutoRemark) {
      setRemark(getSuggestedRemark(protoId, nextSec, port));
      setIsRemarkCustom(false);
    }
  };

  const handleUpdatePort = (newPort: number) => {
    setPort(newPort);
    if (!isRemarkCustom && newPort > 0) {
      setRemark(getSuggestedRemark(protocol, security, newPort));
    }
  };

  // Find next free port
  const handlePickNextAvailablePort = async () => {
    const occupiedPorts = new Set(
      (existingInbounds || [])
        .map((i) => Number(i.port))
        .filter((p) => !isNaN(p) && p > 0)
    );
    const commonPorts = [2053, 2054, 2055, 2056, 2083, 2087, 2096, 8443, 8080, 443, 10443, 20443];
    let candidate = (port && port > 0 ? port : 2053) + 1;
    if (candidate > 65000) candidate = 2054;
    
    // Check candidates
    for (let p of [candidate, ...commonPorts]) {
      if (occupiedPorts.has(p)) continue;
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
          handleUpdatePort(p);
          setPortConflict(null);
          setPortOccupiedBy(null);
          notify.success('Port Assigned', `Found available port ${p}`);
          return;
        }
      } catch (e) {}
    }

    while (occupiedPorts.has(candidate) && candidate < 65535) {
      candidate++;
    }
    handleUpdatePort(candidate);
    setPortConflict(null);
    setPortOccupiedBy(null);
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
      let keyToUse = wgSecretKey;
      if (!keyToUse) {
        try {
          const res = await api.get('/api/crypto/wireguard-keys');
          if (res.data?.success && res.data.privateKey) {
            keyToUse = res.data.privateKey;
            setWgSecretKey(keyToUse);
          }
        } catch (e) {}
      }
      settingsObj = {
        secretKey: keyToUse,
        mtu: wgMtu || 1420,
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 cursor-pointer"
    >
      {/* Modal Dialog Window */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#161617] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto h-[90vh] sm:h-[86vh] max-h-[860px] min-h-[580px] relative animate-in zoom-in-95 duration-200 cursor-default"
      >

        {/* Modal Top Header Bar */}
        <div className="px-6 py-4 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-[#161617] relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-300">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  {inboundToEdit ? 'Edit Inbound Listener' : 'Create Inbound Listener'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  {protocol}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 font-medium">
                <span className="text-neutral-600 dark:text-neutral-400">Port {port}</span>
                <span>•</span>
                <span className="text-neutral-600 dark:text-neutral-400 uppercase">{network}</span>
                <span>•</span>
                <span className={security === 'reality' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : security === 'tls' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-neutral-500'}>
                  {security.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          
          {/* Tactile Rotating Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close modal (Esc)"
            className="group/close p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 active:scale-90 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="hidden sm:inline text-[10px] font-mono font-semibold text-neutral-500 group-hover/close:text-neutral-700 dark:group-hover/close:text-neutral-300">Esc</span>
            <X className="w-4 h-4 transition-transform duration-200 group-hover/close:rotate-90 group-hover/close:scale-110" />
          </button>
        </div>

        {/* Segmented Pill Tabs Navigation */}
        <div className="p-2 bg-neutral-50/80 dark:bg-[#161617] border-b border-neutral-200/80 dark:border-neutral-800 relative z-10 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-neutral-200/60 dark:bg-neutral-950 rounded-xl border border-neutral-300/50 dark:border-neutral-850">
            {[
              { id: 'basics', label: '1. Basics & Port', icon: Server },
              { id: 'transport', label: '2. Transport & UDP', icon: Radio },
              { id: 'security', label: '3. Security & TLS', icon: Shield },
              { id: 'advanced', label: '4. Advanced Tuning', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-no-invert
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`modal-tab-btn py-2 px-3 rounded-lg text-xs transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 border cursor-pointer select-none ${
                    isActive
                      ? 'modal-tab-active bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white font-bold border-neutral-300 dark:border-neutral-700 shadow-sm'
                      : 'modal-tab-inactive text-neutral-700 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-900/80 border-transparent font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Form Body */}
        <form id="inbound-form" onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0 relative z-10">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono flex items-center gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: BASICS & PORT */}
          {activeTab === 'basics' && (
            <div className="space-y-5">
              
              {/* Protocol Visual Selector (First Priority) */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                      <Layers className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                      Proxy Protocol Architecture
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-neutral-850 text-neutral-300 border border-neutral-750">
                    {protocol.toUpperCase()}
                  </span>
                </div>
                
                {/* Protocol Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {PROTOCOLS.map((p) => {
                    const isSelected = protocol === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProtocol(p.id)}
                        className={`inbound-select-card p-3 rounded-xl text-left relative flex flex-col justify-between cursor-pointer select-none ${
                          isSelected
                            ? 'inbound-select-card-selected'
                            : 'inbound-select-card-unselected'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span 
                              className={`card-title text-xs font-bold font-mono tracking-tight ${isSelected ? 'text-white' : ''}`}
                              style={isSelected ? { color: '#ffffff' } : undefined}
                            >
                              {p.name}
                            </span>
                            {isSelected && (
                              <div className="card-check-badge w-4 h-4 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-white">
                                <Check className="w-2.5 h-2.5 stroke-[3]" style={{ stroke: '#0071e3', color: '#0071e3' }} />
                              </div>
                            )}
                          </div>
                          <p className="card-desc text-[10px] leading-tight mb-2 line-clamp-1">{p.desc}</p>
                        </div>

                        {/* Visual Security & Transport capability indicators */}
                        <div className="card-divider space-y-1 pt-1.5 border-t">
                          <div className="flex items-center gap-1.5 text-[9px] font-mono">
                            <Shield className={`w-2.5 h-2.5 shrink-0 ${isSelected ? 'card-shield-icon' : 'text-emerald-500 dark:text-emerald-400'}`} />
                            <span className="card-spec-text truncate">{p.securitySummary}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-mono">
                            <Radio className={`w-2.5 h-2.5 shrink-0 ${isSelected ? 'card-radio-icon' : 'text-blue-500 dark:text-blue-400'}`} />
                            <span className="card-spec-text truncate">{p.transportSummary}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Active Protocol Architecture Compatibility Matrix */}
                {(() => {
                  const currentProto = PROTOCOLS.find((p) => p.id === protocol) || PROTOCOLS[0];
                  return (
                    <div className="mt-3 p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-xs font-semibold text-neutral-200 font-mono uppercase tracking-wider">
                            {currentProto.name} Architecture Matrix
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 bg-neutral-850 px-2 py-0.5 rounded border border-neutral-750">
                          Xray Specification
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-0.5">
                        {/* Security Capability */}
                        <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 font-mono">
                            <Shield className="w-3 h-3" />
                            <span>Supported Security</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {currentProto.supportedSecurities.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ✓ {s.toUpperCase()}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-snug">
                            {currentProto.unsupportedSecuritiesText}
                          </p>
                        </div>

                        {/* Transport Capability */}
                        <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 font-mono">
                            <Radio className="w-3 h-3" />
                            <span>Supported Transports</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {currentProto.isFixedTransport ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                ⚡ {currentProto.fixedTransportName}
                              </span>
                            ) : (
                              currentProto.supportedTransports.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  ✓ {t.toUpperCase()}
                                </span>
                              ))
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-snug">
                            {currentProto.unsupportedTransportsText}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Field 2: Inbound Remark with Dynamic Placeholder */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                      <Tag className="w-3 h-3" />
                    </div>
                    <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                      Inbound Remark & Label
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400">
                    Friendly Identifier
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={remark}
                    onChange={(e) => {
                      setRemark(e.target.value);
                      setIsRemarkCustom(true);
                    }}
                    placeholder={`e.g. ${getSuggestedRemark(protocol, security, port)}`}
                    className="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 font-mono transition"
                  />
                </div>
              </div>

              {/* Field 2 & 3: Port with Guard & Listen IP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Port Section with Intelligent Collision Guard UI */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                        <Hash className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                        Listening Port
                      </label>
                    </div>
                    {isCheckingPort ? (
                      <span className="text-[10px] text-blue-400 font-mono animate-pulse">Scanning...</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        portConflict 
                          ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' 
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
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
                      value={port === 0 ? '' : port}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === '') {
                          handleUpdatePort(0);
                        } else {
                          const val = parseInt(raw, 10);
                          if (!isNaN(val)) {
                            handleUpdatePort(val);
                          }
                        }
                      }}
                      placeholder="e.g. 2083"
                      className={`w-full px-3.5 py-2 bg-[#0e0e12] border rounded-xl text-xs font-mono text-white focus:outline-none transition ${
                        portConflict 
                          ? 'border-rose-500/80 bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30' 
                          : 'border-neutral-800 focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600'
                      }`}
                    />
                  </div>

                  {/* Quick Preset Port Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[443, 8443, 2053, 2083, 2087, 2096].map((p) => {
                      const isActive = port === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          data-no-invert="true"
                          data-active={isActive ? "true" : "false"}
                          onClick={() => handleUpdatePort(p)}
                          className={`preset-pill text-[10px] px-2.5 py-0.5 rounded-lg font-mono border transition cursor-pointer ${
                            isActive ? 'active' : ''
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      data-no-invert="true"
                      data-active="false"
                      onClick={handlePickNextAvailablePort}
                      className="preset-pill text-[10px] px-2.5 py-0.5 rounded-lg font-mono flex items-center gap-1 transition cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Suggest Free</span>
                    </button>
                  </div>

                  {/* Port Conflict Alert UI */}
                  {portConflict && (
                    <div className="mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-600 dark:text-rose-200 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-medium">{portConflict}</span>
                          {portOccupiedBy && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">Service Detected:</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-bold">
                                {portOccupiedBy}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handlePickNextAvailablePort}
                        className="self-start px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[10px] font-medium text-rose-700 dark:text-white flex items-center gap-1 transition cursor-pointer active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Assign Next Free Port Automatically</span>
                      </button>
                    </div>
                  )}

                  {/* Server Firewall Rule Status Card */}
                  {firewallInfo && (
                    <div className={`mt-2 p-3 rounded-xl border text-[11px] flex flex-col gap-1.5 transition ${
                      firewallInfo.isOpen
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className={`w-3.5 h-3.5 ${firewallInfo.isOpen ? 'text-emerald-400' : 'text-amber-400'}`} />
                          <span className="font-semibold font-mono tracking-wide text-[10px] uppercase">
                            {firewallInfo.status}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-medium tracking-wider uppercase border ${
                          firewallInfo.isOpen
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {firewallInfo.isOpen ? 'RULE ALLOWED' : 'RULE BLOCKED'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-300 leading-relaxed">
                        {firewallInfo.details}
                      </p>
                      {!firewallInfo.isOpen && firewallInfo.command && (
                        <div className="flex items-center justify-between gap-2 pt-1.5 mt-0.5 border-t border-amber-500/20">
                          <code className="text-[10px] font-mono bg-neutral-900 px-2 py-0.5 rounded text-amber-300 select-all border border-amber-500/20">
                            {firewallInfo.command}
                          </code>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await copyToClipboard(firewallInfo.command!);
                              if (ok) notify.success('Copied Command', 'Firewall unblock command copied to clipboard.');
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Command</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Listen IP with styled UI Label */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                        <Globe className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                        Listening Interface IP
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400">
                      Bind Socket
                    </span>
                  </div>
                  <input
                    type="text"
                    value={listen}
                    onChange={(e) => setListen(e.target.value)}
                    placeholder="0.0.0.0"
                    className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-neutral-600 transition"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {['0.0.0.0', '127.0.0.1', '::'].map((ip) => {
                      const isActive = listen === ip;
                      return (
                        <button
                          key={ip}
                          type="button"
                          data-no-invert="true"
                          data-active={isActive ? "true" : "false"}
                          onClick={() => setListen(ip)}
                          className={`preset-pill text-[10px] px-2.5 py-0.5 rounded-lg font-mono border transition cursor-pointer ${
                            isActive ? 'active' : ''
                          }`}
                        >
                          {ip === '0.0.0.0' ? 'All (0.0.0.0)' : ip === '127.0.0.1' ? 'Local Only' : 'IPv6 (::)'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Traffic Quota & Expiry Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Traffic Quota */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                        <Database className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-0">
                        Total Inbound Quota (GB)
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400">
                      {totalGB === 0 ? 'Unlimited' : `${totalGB} GB`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={totalGB}
                    onChange={(e) => setTotalGB(Number(e.target.value))}
                    placeholder="0 = Unlimited"
                    className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-neutral-600 transition"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[0, 50, 100, 500, 1000].map((q) => {
                      const isActive = totalGB === q;
                      return (
                        <button
                          key={q}
                          type="button"
                          data-no-invert="true"
                          data-active={isActive ? "true" : "false"}
                          onClick={() => setTotalGB(q)}
                          className={`preset-pill text-[10px] px-2.5 py-0.5 rounded-lg font-mono border transition cursor-pointer ${
                            isActive ? 'active' : ''
                          }`}
                        >
                          {q === 0 ? 'Unlimited' : `${q}GB`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Expiry Time */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                        <Calendar className="w-3 h-3" />
                      </div>
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-0">
                        Lifespan Duration (Days)
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-400">
                      {expiryDays === 0 ? 'No Expiry' : `${expiryDays} Days`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    placeholder="0 = Never expires"
                    className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-neutral-600 transition"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[0, 30, 90, 180, 365].map((d) => {
                      const isActive = expiryDays === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          data-no-invert="true"
                          data-active={isActive ? "true" : "false"}
                          onClick={() => setExpiryDays(d)}
                          className={`preset-pill text-[10px] px-2.5 py-0.5 rounded-lg font-mono border transition cursor-pointer ${
                            isActive ? 'active' : ''
                          }`}
                        >
                          {d === 0 ? 'Forever' : `${d}d`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Protocol-Specific Primary Credentials (Shadowsocks / WireGuard) */}
              {protocol === 'shadowsocks' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-neutral-300" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Shadowsocks 2022 / AEAD Primary Key
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateShadowsocksKey}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Key</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Encryption Method</label>
                      <select
                        value={ssMethod}
                        onChange={(e) => setSsMethod(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      >
                        <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm (16-byte key)</option>
                        <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm (32-byte key)</option>
                        <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305 (32-byte key)</option>
                        <option value="aes-256-gcm">aes-256-gcm (AEAD)</option>
                        <option value="aes-128-gcm">aes-128-gcm (AEAD)</option>
                        <option value="chacha20-poly1305">chacha20-poly1305 (AEAD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Network Relay</label>
                      <select
                        value={ssNetwork}
                        onChange={(e) => setSsNetwork(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      >
                        <option value="tcp,udp">TCP + UDP (Standard)</option>
                        <option value="tcp">TCP Only</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">Shared Secret Password / Base64 Key</label>
                    <input
                      type="text"
                      value={ssPassword}
                      onChange={(e) => setSsPassword(e.target.value)}
                      placeholder="Click 'Generate Key' for 2022 key or enter password"
                      className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:border-neutral-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {protocol === 'wireguard' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        WireGuard Inbound Tunnel Parameters
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateWireGuardKeys}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Keypair</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Server Private Key (Base64)</label>
                      <input
                        type="text"
                        value={wgSecretKey}
                        onChange={(e) => setWgSecretKey(e.target.value)}
                        placeholder="Click Generate Keypair"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Tunnel MTU</label>
                      <input
                        type="number"
                        min={1280}
                        max={1500}
                        value={wgMtu}
                        onChange={(e) => setWgMtu(Number(e.target.value))}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRANSPORT & UDP STREAM */}
          {activeTab === 'transport' && (
            <div className="space-y-4">
              
              {(() => {
                const currentProto = PROTOCOLS.find((p) => p.id === protocol) || PROTOCOLS[0];
                if (currentProto.isFixedTransport) {
                  return (
                    <div className="p-6 rounded-xl bg-neutral-950 border border-neutral-850 text-center space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center justify-center mx-auto">
                        <Radio className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-neutral-900 text-neutral-200 border border-neutral-800">
                        <span>{currentProto.fixedTransportName}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                        Dedicated Protocol Transport Layer
                      </h4>
                      <p className="text-xs text-neutral-400 max-w-lg mx-auto leading-relaxed">
                        {currentProto.fixedTransportDesc}
                      </p>
                    </div>
                  );
                }

                // Filter transports based on protocol and active security
                const availableTransports = TRANSPORTS.filter((t) => {
                  if (!currentProto.supportedTransports.includes(t.id as any)) {
                    return false;
                  }
                  if (security === 'reality') {
                    // Official Xray docs: "REALITY only supports RAW (TCP), XHTTP, and gRPC transports."
                    return t.id === 'tcp' || t.id === 'splithttp' || t.id === 'grpc';
                  }
                  return true;
                });

                return (
                  <>
                    {/* Transport Network Selector Grid */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                            <Radio className="w-3 h-3 text-blue-400" />
                          </div>
                          <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                            Network Stream Transport Layer
                          </label>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-neutral-900 text-neutral-300 border border-neutral-800">
                          {network.toUpperCase()}
                        </span>
                      </div>

                      {security === 'reality' && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>XTLS REALITY operates exclusively over <strong>TCP</strong>, <strong>SplitHTTP (XHTTP)</strong>, and <strong>gRPC</strong>.</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableTransports.map((t) => {
                          const isSelected = network === t.id;
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setNetwork(t.id)}
                              className={`inbound-select-card p-3 rounded-xl text-left relative flex flex-col justify-between cursor-pointer select-none ${
                                isSelected
                                  ? 'inbound-select-card-selected'
                                  : 'inbound-select-card-unselected'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'card-radio-icon' : 'text-blue-500 dark:text-blue-400'}`} />
                                  <span 
                                    className={`card-title text-xs font-bold font-mono ${isSelected ? 'text-white' : ''}`}
                                    style={isSelected ? { color: '#ffffff' } : undefined}
                                  >
                                    {t.name}
                                  </span>
                                </div>
                                {isSelected && (
                                  <div className="card-check-badge w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-white">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" style={{ stroke: '#0071e3', color: '#0071e3' }} />
                                  </div>
                                )}
                              </div>
                              <p className="card-desc text-[10px] leading-tight">{t.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Dynamic Transport Sub-Panels with Clean UI */}

              {/* WebSocket Config */}
              {network === 'ws' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">WebSocket Inbound Options</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">WS Path</label>
                      <input
                        type="text"
                        value={wsPath}
                        onChange={(e) => setWsPath(e.target.value)}
                        placeholder="/vless-ws"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">WS Host Header</label>
                      <input
                        type="text"
                        value={wsHost}
                        onChange={(e) => setWsHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* gRPC Config */}
              {network === 'grpc' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">gRPC Tunneling Options</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">gRPC Service Name</label>
                    <input
                      type="text"
                      value={grpcServiceName}
                      onChange={(e) => setGrpcServiceName(e.target.value)}
                      placeholder="vless-grpc"
                      className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={grpcMultiMode}
                      onChange={(e) => setGrpcMultiMode(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0"
                    />
                    <span>Enable MultiMode (Gun architecture multiplexing)</span>
                  </label>
                </div>
              )}

              {/* HTTPUpgrade Config */}
              {network === 'httpupgrade' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <ArrowDownUp className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">HTTPUpgrade Options</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Path</label>
                      <input
                        type="text"
                        value={httpUpgradePath}
                        onChange={(e) => setHttpUpgradePath(e.target.value)}
                        placeholder="/httpupgrade"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Host Header</label>
                      <input
                        type="text"
                        value={httpUpgradeHost}
                        onChange={(e) => setHttpUpgradeHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SplitHTTP / XHTTP Config */}
              {(network === 'splithttp' || network === 'xhttp') && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">SplitHTTP / XHTTP Next-Gen Stream</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800">
                      Modern CDN
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">XHTTP Path</label>
                      <input
                        type="text"
                        value={splitHttpPath}
                        onChange={(e) => setSplitHttpPath(e.target.value)}
                        placeholder="/xhttp"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Host Header</label>
                      <input
                        type="text"
                        value={splitHttpHost}
                        onChange={(e) => setSplitHttpHost(e.target.value)}
                        placeholder="e.g. cdn.domain.com"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">Transmission Mode</label>
                    <select
                      value={splitHttpMode}
                      onChange={(e) => setSplitHttpMode(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
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
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">mKCP High-Speed UDP Configuration</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      BBR Accelerated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Header Masquerade Camouflage</label>
                      <select
                        value={kcpHeaderType}
                        onChange={(e) => setKcpHeaderType(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
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
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Obfuscation Seed</label>
                      <input
                        type="text"
                        value={kcpSeed}
                        onChange={(e) => setKcpSeed(e.target.value)}
                        placeholder="Optional traffic scrambling seed"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">MTU (Bytes)</label>
                      <input
                        type="number"
                        min={576}
                        max={1460}
                        value={kcpMtu}
                        onChange={(e) => setKcpMtu(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#0e0e12] border border-neutral-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">TTI (ms)</label>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={kcpTti}
                        onChange={(e) => setKcpTti(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#0e0e12] border border-neutral-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">Uplink Cap (MB/s)</label>
                      <input
                        type="number"
                        min={1}
                        value={kcpUpCap}
                        onChange={(e) => setKcpUpCap(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#0e0e12] border border-neutral-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">Downlink Cap (MB/s)</label>
                      <input
                        type="number"
                        min={1}
                        value={kcpDownCap}
                        onChange={(e) => setKcpDownCap(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-[#0e0e12] border border-neutral-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={kcpCongestion}
                      onChange={(e) => setKcpCongestion(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-0"
                    />
                    <span>Enable Congestion Control (Smooth throughput & drop resistance)</span>
                  </label>
                </div>
              )}

              {/* TCP Header */}
              {network === 'tcp' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                        <Terminal className="w-3 h-3 text-blue-400" />
                      </div>
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                        TCP Header Obfuscation
                      </label>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-neutral-900 text-neutral-300 border border-neutral-800">
                      {tcpHeaderType.toUpperCase()}
                    </span>
                  </div>
                  <select
                    value={tcpHeaderType}
                    onChange={(e) => setTcpHeaderType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
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
              
              {(() => {
                const currentProto = PROTOCOLS.find((p) => p.id === protocol) || PROTOCOLS[0];
                if (currentProto.isFixedSecurity) {
                  return (
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <span>{currentProto.fixedSecurityName}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        Built-in Cryptographic Architecture
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                        {currentProto.fixedSecurityDesc}
                      </p>
                    </div>
                  );
                }

                // Filter security options supported by current protocol
                const securityOptions = [
                  {
                    id: 'none',
                    title: 'None',
                    desc: 'Plaintext (Internal / CDN WS / Reverse Proxy)',
                    icon: Globe,
                    badge: 'Standard',
                    supported: currentProto.supportedSecurities.includes('none'),
                  },
                  {
                    id: 'tls',
                    title: 'TLS 1.3',
                    desc: protocol === 'hysteria' ? 'Mandatory QUIC TLS Certificate' : 'Standard SSL / Let\'s Encrypt',
                    icon: Lock,
                    badge: 'Encrypted',
                    supported: currentProto.supportedSecurities.includes('tls'),
                  },
                  {
                    id: 'reality',
                    title: 'REALITY',
                    desc: 'Zero-Cert TLS 1.3 Camouflage',
                    icon: Shield,
                    badge: 'Stealth',
                    supported: currentProto.supportedSecurities.includes('reality'),
                  },
                ].filter((s) => s.supported);

                return (
                  <>
                    {/* Security Protocol Cards */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                            <Shield className="w-3 h-3 text-emerald-400" />
                          </div>
                          <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                            Security & Encryption Layer
                          </label>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-neutral-900 text-neutral-300 border border-neutral-800">
                          {security.toUpperCase()}
                        </span>
                      </div>

                      {protocol === 'hysteria' && (
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
                          <span>QUIC protocol mandates TLS encryption for every session. Self-signed or CA certs can be used.</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {securityOptions.map((s) => {
                          const isSelected = security === s.id;
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSecurity(s.id);
                                if (s.id === 'reality') {
                                  if (network !== 'tcp' && network !== 'splithttp' && network !== 'grpc') {
                                    setNetwork('tcp');
                                  }
                                  if (!realityPrivKey) handleGenerateRealityKeys();
                                }
                                if (!isRemarkCustom) {
                                  setRemark(getSuggestedRemark(protocol, s.id, port));
                                }
                              }}
                              className={`inbound-select-card p-3 rounded-xl text-left relative flex flex-col justify-between cursor-pointer select-none ${
                                isSelected
                                  ? 'inbound-select-card-selected'
                                  : 'inbound-select-card-unselected'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${isSelected ? 'card-shield-icon' : 'text-emerald-500 dark:text-emerald-400'}`} />
                                  <span 
                                    className={`card-title text-xs font-bold font-mono ${isSelected ? 'text-white' : ''}`}
                                    style={isSelected ? { color: '#ffffff' } : undefined}
                                  >
                                    {s.title}
                                  </span>
                                </div>
                                {isSelected && (
                                  <div className="card-check-badge w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-white">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" style={{ stroke: '#0071e3', color: '#0071e3' }} />
                                  </div>
                                )}
                              </div>
                              <p className="card-desc text-[10px] leading-tight">{s.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* REALITY Settings Card */}
              {security === 'reality' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        REALITY Handshake Camouflage Parameters
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateRealityKeys}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate Keypair</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Target Destination (dest)</label>
                      <input
                        type="text"
                        value={realityDest}
                        onChange={(e) => setRealityDest(e.target.value)}
                        placeholder="www.google.com:443"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { name: 'Google', dest: 'www.google.com:443', sni: 'www.google.com' },
                          { name: 'Cloudflare', dest: 'speed.cloudflare.com:443', sni: 'speed.cloudflare.com' },
                          { name: 'Microsoft', dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
                          { name: 'Apple', dest: 'www.apple.com:443', sni: 'www.apple.com' },
                          { name: 'Yahoo', dest: 'www.yahoo.com:443', sni: 'www.yahoo.com' },
                        ].map((d) => {
                          const isActive = realityDest === d.dest;
                          return (
                            <button
                              key={d.name}
                              type="button"
                              data-no-invert="true"
                              data-active={isActive ? "true" : "false"}
                              onClick={() => {
                                setRealityDest(d.dest);
                                setRealityServerNames(d.sni);
                              }}
                              className={`preset-pill text-[10px] px-2.5 py-0.5 rounded-md font-mono border transition cursor-pointer ${
                                isActive ? 'active' : ''
                              }`}
                            >
                              {d.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Server Names (SNI List)</label>
                      <input
                        type="text"
                        value={realityServerNames}
                        onChange={(e) => setRealityServerNames(e.target.value)}
                        placeholder="www.google.com,google.com"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                      <span className="text-[10px] text-neutral-500 font-mono mt-1 block">
                        Comma-separated domain list matching dest target
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Server Private Key (x25519)</label>
                      <input
                        type="text"
                        value={realityPrivKey}
                        onChange={(e) => setRealityPrivKey(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Client Public Key (x25519)</label>
                      <input
                        type="text"
                        value={realityPubKey}
                        readOnly
                        className="w-full px-3.5 py-2 bg-neutral-900/60 border border-neutral-800 rounded-xl text-xs text-neutral-300 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Short ID</label>
                      <input
                        type="text"
                        value={realityShortId}
                        onChange={(e) => setRealityShortId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">SpiderX Path</label>
                      <input
                        type="text"
                        value={realitySpiderX}
                        onChange={(e) => setRealitySpiderX(e.target.value)}
                        placeholder="/"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TLS Settings Card */}
              {security === 'tls' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <Lock className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">TLS Configuration</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">SNI Domain (serverName)</label>
                      <input
                        type="text"
                        value={tlsSNI}
                        onChange={(e) => setTlsSNI(e.target.value)}
                        placeholder="e.g. proxy.domain.com"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">ALPN</label>
                      <input
                        type="text"
                        value={tlsALPN}
                        onChange={(e) => setTlsALPN(e.target.value)}
                        placeholder="h2,http/1.1"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">Min TLS Version</label>
                      <select
                        value={tlsMinVersion}
                        onChange={(e) => setTlsMinVersion(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono"
                      >
                        <option value="1.2">TLS 1.2</option>
                        <option value="1.3">TLS 1.3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">Max TLS Version</label>
                      <select
                        value={tlsMaxVersion}
                        onChange={(e) => setTlsMaxVersion(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono"
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
            <div className="space-y-4">
              
              {/* Protocol Specific Card (Shadowsocks / WireGuard / Hysteria) */}
              {protocol === 'shadowsocks' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-neutral-300" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Shadowsocks 2022 & FullCone UDP
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateShadowsocksKey}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Key</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Encryption Cipher</label>
                      <select
                        value={ssMethod}
                        onChange={(e) => setSsMethod(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      >
                        <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm (Fast Standard)</option>
                        <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm (High Security)</option>
                        <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305 (ARM/Mobile)</option>
                        <option value="aes-128-gcm">aes-128-gcm (Legacy AEAD)</option>
                        <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305 (Legacy AEAD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Network Modes</label>
                      <select
                        value={ssNetwork}
                        onChange={(e) => setSsNetwork(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      >
                        <option value="tcp,udp">TCP + UDP (FullCone Relay)</option>
                        <option value="tcp">TCP Only</option>
                        <option value="udp">UDP Only</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">Master Base64 Password Key</label>
                    <input
                      type="text"
                      value={ssPassword}
                      onChange={(e) => setSsPassword(e.target.value)}
                      placeholder="Click Generate Key or enter base64 key"
                      className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:border-neutral-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {protocol === 'wireguard' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        WireGuard Kernel/Go-Tun Tunnel
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateWireGuardKeys}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-[10px] font-mono flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Keypair</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Server Private Key (Base64)</label>
                      <input
                        type="text"
                        value={wgSecretKey}
                        onChange={(e) => setWgSecretKey(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Inner MTU</label>
                      <input
                        type="number"
                        min={1280}
                        max={1500}
                        value={wgMtu}
                        onChange={(e) => setWgMtu(Number(e.target.value))}
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {protocol === 'dokodemo-door' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <ArrowUpRight className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                      Dokodemo-door Forwarding Target
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Destination IP / Host</label>
                      <input
                        type="text"
                        value={dokoAddress}
                        onChange={(e) => setDokoAddress(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">Destination Port</label>
                      <input
                        type="number"
                        value={dokoPort}
                        onChange={(e) => setDokoPort(Number(e.target.value))}
                        placeholder="0 = Transparent"
                        className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={dokoFollowRedirect}
                      onChange={(e) => setDokoFollowRedirect(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0"
                    />
                    <span>Follow Redirect (Accept Linux iptables/nftables TPROXY & REDIRECT)</span>
                  </label>
                </div>
              )}

              {/* Linux Socket Options (Sockopt) */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                      <Cpu className="w-3 h-3 text-blue-400" />
                    </div>
                    <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                      Linux Socket Performance Options (Sockopt)
                    </label>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800">
                    Kernel Level
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3 rounded-xl bg-[#0c0d10] border border-neutral-800/80 flex items-center justify-between cursor-pointer hover:border-neutral-700 transition">
                    <div>
                      <span className="text-xs font-medium text-white block">TCP Fast Open (TFO)</span>
                      <span className="text-[10px] text-neutral-400">0-RTT data in SYN packet</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={sockoptTcpFastOpen}
                      onChange={(e) => setSockoptTcpFastOpen(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0 w-4 h-4"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-[#0c0d10] border border-neutral-800/80 flex items-center justify-between cursor-pointer hover:border-neutral-700 transition">
                    <div>
                      <span className="text-xs font-medium text-white block">Accept PROXY Protocol</span>
                      <span className="text-[10px] text-neutral-400">Real Client IP from Cloudflare/Nginx</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={sockoptAcceptProxyProtocol}
                      onChange={(e) => setSockoptAcceptProxyProtocol(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">TProxy Mode</label>
                    <select
                      value={sockoptTproxy}
                      onChange={(e) => setSockoptTproxy(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                    >
                      <option value="off">Off (Standard Socket)</option>
                      <option value="tproxy">TProxy (Transparent Proxying)</option>
                      <option value="redirect">Redirect (iptables REDIRECT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">SO_MARK (Routing Mark)</label>
                    <input
                      type="number"
                      value={sockoptMark}
                      onChange={(e) => setSockoptMark(Number(e.target.value))}
                      placeholder="0 = None"
                      className="w-full px-3.5 py-2 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs text-white font-mono focus:border-neutral-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Traffic Sniffing */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                      <Globe className="w-3 h-3 text-blue-400" />
                    </div>
                    <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                      Real-time Traffic Sniffing
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sniffingEnabled}
                      onChange={(e) => setSniffingEnabled(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0"
                    />
                    <span className="font-medium">Active</span>
                  </label>
                </div>

                {sniffingEnabled && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                            ? 'bg-neutral-850 border-neutral-600 text-white' 
                            : 'bg-[#0c0d10] border-neutral-800 text-neutral-400'
                        }`}
                      >
                        <span className="text-xs font-mono font-medium">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Port 443 Fallbacks */}
              {(protocol === 'vless' || protocol === 'trojan') && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-neutral-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Port 443 Multi-Fallback Rules
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Nginx/Caddy Coexistence</span>
                  </div>
                  <textarea
                    rows={3}
                    value={fallbacksJson}
                    onChange={(e) => setFallbacksJson(e.target.value)}
                    placeholder='[{"dest": 80, "xver": 0}]'
                    className="w-full px-3.5 py-2.5 bg-[#0e0e12] border border-neutral-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-neutral-600"
                  />
                  <p className="text-[10px] text-neutral-500 font-mono">
                    Routes non-proxy traffic to local web servers seamlessly without triggering active DPI probes.
                  </p>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Modal Footer with Status Indicator & Submit Action (Pinned to Bottom) */}
        <div className="p-4 sm:px-6 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between z-20 bg-white dark:bg-[#161617] shrink-0 min-h-[64px]">
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${portConflict ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className={`text-xs font-mono font-bold shrink-0 ${portConflict ? 'text-rose-500' : 'text-emerald-500'}`}>
              {portConflict ? 'Port Conflict' : 'Port Ready'}
            </span>
            {portConflict && (
              <button
                type="button"
                onClick={handlePickNextAvailablePort}
                className="ml-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 hover:border-rose-500/50 transition-colors cursor-pointer shrink-0"
                title="Automatically suggest and assign a free port"
              >
                Auto-Resolve
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-transparent dark:hover:bg-neutral-800 transition-colors border border-neutral-200 dark:border-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              form="inbound-form"
              type="submit"
              disabled={Boolean(portConflict) || isSubmitting}
              className={`min-w-[145px] h-[38px] px-5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 border select-none shrink-0 ${
                portConflict
                  ? 'opacity-40 cursor-not-allowed bg-neutral-300/80 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-500 border-neutral-300 dark:border-neutral-800 pointer-events-none'
                  : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 border-neutral-900 dark:border-white cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Saving Inbound...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5] shrink-0" />
                  <span>{inboundToEdit ? 'Update Inbound' : 'Create Inbound'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
