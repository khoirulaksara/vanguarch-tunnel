export interface TunnelConfig {
  id: string;
  name: string;
  localUrl: string;
  localVhost: string;
  publicDomain: string;
  tunnelName: string;
  protocol?: 'http' | 'tcp' | 'ssh' | 'rdp';
  enableInspector?: boolean;
  /** Absolute path to the project on disk. Required for Laravel .env injection. */
  projectPath?: string;
  /** Detected framework, e.g. 'Laravel'. Used to gate env injection logic. */
  framework?: string;
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
  startedAt?: number;
  stoppedAt?: number;
}

export interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  framework: string;
  suggestedUrl: string;
  wpHelperInstalled?: boolean;
  laravelProxyInstalled?: boolean;
}

export interface SessionRecord {
  id: string;
  name: string;
  localUrl: string;
  publicDomain: string;
  startedAt: number;
  stoppedAt: number;
  durationMs: number;
}
