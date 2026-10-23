export interface ServerStatus {
  xrayRunning: boolean;
  xrayVersion: string;
  serverTime: number;
  cpu: {
    usedPercent: number;
    cores: number;
    freqGHz: number;
    model: string;
    avg: number;
    peak: number;
    history: number[];
  };
  mem: {
    usedPercent: number;
    used: number;
    total: number;
    available?: number;
    free: number;
    buffers?: number;
    cached?: number;
    type?: string;
    speedMHz?: number;
    display?: string;
    avg: number;
    peak: number;
    history: number[];
  };
  swap: {
    usedPercent: number;
    used: number;
    total: number;
    history?: number[];
  };
  disk: {
    usedPercent: number;
    used: number;
    total: number;
    free: number;
  };
  net: {
    bytesSent: number;
    bytesRecv: number;
    speedUp: number;
    speedDown: number;
    peakSpeed: number;
    historyUp: number[];
    historyDown: number[];
  };
  sockets: {
    total: number;
    tcp: number;
    udp: number;
    history?: number[];
  };
  uptime: {
    os: number | string;
    xray: number | string;
  };
  panel: {
    memMB: number;
    threads: number;
  };
  os: string;
  publicIP: string;
  panelVersion?: string;
}

export interface Client {
  id: number;
  inboundId: number;
  email: string;
  uuid: string;
  password?: string;
  flow?: string;
  enable: boolean;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  subId: string;
  lastOnline?: number;
  isOnline?: boolean;
  upSpeed?: number;
  downSpeed?: number;
  inboundTag?: string;
  inboundPort?: number;
  inboundProtocol?: string;
  inboundRemark?: string;
  link?: string;
}

export interface Inbound {
  id: number;
  tag: string;
  listen: string;
  port: number;
  protocol: string;
  enable: boolean;
  remark: string;
  settings: string;
  streamSettings: string;
  sniffing: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  clients?: Client[];
}

export interface SSLCertificate {
  domain: string;
  isCustom: boolean;
  certPath: string;
  keyPath: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  expiresInDays: number;
  isExpired: boolean;
  san: string[];
}

export interface UpdateInfo {
  panel: {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes: string;
    publishedAt: string;
  };
  xray: {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes: string;
    publishedAt: string;
  };
}
