export interface TunnelConfig {
  id: string;
  name: string;
  localUrl: string;
  localVhost: string;
  publicDomain: string;
  tunnelName: string;
  options: {
    httpHostHeader: boolean;
    originServerName: boolean;
    forceHttp2: boolean;
    ipv4Only: boolean;
  };
}

export interface TunnelLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

export type ProcessStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TunnelProcess {
  config: TunnelConfig;
  status: ProcessStatus;
  logs: TunnelLog[];
  command: string;
}

export interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  framework: 'WordPress' | 'Laravel' | 'Next.js' | 'Vite' | 'Unknown';
  suggestedUrl: string;
  wpHelperInstalled?: boolean;
}
