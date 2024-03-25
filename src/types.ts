import { LogLevel } from './logging';

export type SupportedOS = 'windows' | 'linux' | 'alpine' | 'macos' | 'aix';

export type PlatformInfo = {
  os: SupportedOS | null;
  arch: string;
};

export type JreMetaData = {
  filename: string;
  md5: string;
  javaPath: string;
};

export type ScannerLogEntry = {
  level: LogLevel;
  formattedMessage: string;
  throwable?: string;
};

export type ScannerParams = { [key: string]: string };
