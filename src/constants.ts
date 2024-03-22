import path from 'path';
import { LogLevel } from './logging';

export const SCANNER_BOOTSTRAPPER_NAME = 'ScannerNpm';

export const DEFAULT_LOG_LEVEL = LogLevel.INFO;

export const SONARCLOUD_ENV_REGEX =
  /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)?(sc-dev\.io|sc-staging\.io|sonarcloud\.io)/;

export const SONARQUBE_JRE_PROVISIONING_MIN_VERSION = '10.5';

export const SONAR_CACHE_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.sonar',
  'cache',
);

export const UNARCHIVE_SUFFIX = '_extracted';
