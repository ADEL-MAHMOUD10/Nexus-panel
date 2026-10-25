// Nexus Panel Route Mappings & Deep-Linking Engine

export interface RouteDefinition {
  id: string;
  path: string;
  title: string;
  subtitle?: string;
  aliases?: string[];
}

export const ROUTES: RouteDefinition[] = [
  {
    id: 'overview',
    path: '/',
    title: 'Nexus — Executive Dashboard',
    subtitle: 'Live system telemetry & network analytics',
    aliases: ['/dashboard', '/panel', '/panel/', '/panel/dashboard'],
  },
  {
    id: 'inbounds',
    path: '/inbounds',
    title: 'Nexus — Inbound Listeners',
    subtitle: 'Configure routing interfaces, protocols, and port listeners',
    aliases: ['/panel/inbounds', '/inbound'],
  },
  {
    id: 'clients',
    path: '/clients',
    title: 'Nexus — Client Routes & Accounts',
    subtitle: 'Manage client credentials, quotas, and live connections',
    aliases: ['/panel/clients', '/users', '/panel/users'],
  },
  {
    id: 'certificates',
    path: '/certificates',
    title: 'Nexus — SSL & Security',
    subtitle: 'Automated ACME TLS certificate management and renewals',
    aliases: ['/panel/certificates', '/ssl', '/certs', '/panel/ssl'],
  },
  {
    id: 'config',
    path: '/config',
    title: 'Nexus — Core Engine Configuration',
    subtitle: 'Xray core routing rules, DNS, outbounds, and settings',
    aliases: ['/panel/config', '/settings', '/panel/settings'],
  },
  {
    id: 'logs',
    path: '/logs',
    title: 'Nexus — System & Kernel Logs',
    subtitle: 'Real-time Xray access, error telemetry, and daemon logs',
    aliases: ['/panel/logs', '/xraylogs', '/panel/xraylogs'],
  },
];

/**
 * Resolves browser pathname to an internal tab ID
 */
export function getTabFromPath(pathname: string): string {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  for (const route of ROUTES) {
    if (route.path === cleanPath) {
      return route.id;
    }
    if (route.aliases && route.aliases.some((alias) => alias === cleanPath)) {
      return route.id;
    }
  }

  return 'overview';
}

/**
 * Returns the canonical URL path for a given tab ID
 */
export function getPathFromTab(tabId: string): string {
  const route = ROUTES.find((r) => r.id === tabId);
  return route ? route.path : '/';
}

/**
 * Returns page document title for a tab ID
 */
export function getTitleFromTab(tabId: string): string {
  const route = ROUTES.find((r) => r.id === tabId);
  return route ? route.title : 'Nexus Panel';
}

/**
 * Returns page subtitle for a tab ID
 */
export function getSubtitleFromTab(tabId: string): string | undefined {
  const route = ROUTES.find((r) => r.id === tabId);
  return route ? route.subtitle : undefined;
}
