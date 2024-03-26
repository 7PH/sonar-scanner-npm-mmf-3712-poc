/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2023 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { DEFAULT_LOG_LEVEL } from './constants';
import { fetchJre, isJavaValid } from './java';
import { LogLevel, log, setLogLevel } from './logging';
import { getPlatformInfo } from './platform';
import { fetchScannerEngine, runScannerEngine } from './scanner-engine';
import { fetchServerVersion } from './server';

function parseOptions(options: string[]): { [key: string]: string } {
  return options.reduce((parsedOptions, option) => {
    const [key, value] = option.split('=');
    const cleanedKey = key.replace('-D', '');
    return { ...parsedOptions, [cleanedKey]: value };
  }, {});
}

/**
 * Support for SQ < 9 dropped because login is not part of the properties
 */
export type ScanOptions = {
  serverUrl: string;
  token?: string;
  jvmOptions?: string[];
  options?: { [key: string]: string };
  caPath?: string;
  logLevel?: string;
  verbose?: boolean;
};

const DEFAULT_OPTIONS = {
  'sonar.projectBaseDir': process.cwd(),
};

export async function scan(scanOptions: ScanOptions, cliArgs?: string[]) {
  // the only property from cli commands that would be used before scan execution
  // TODO: check format is correct? (trailing slash causes issue)
  const parsedOptions = cliArgs ? parseOptions(cliArgs) : {};
  const hostUrl = parsedOptions?.['sonar.host.url'];
  const logLevel = parsedOptions?.['sonar.log.level'];

  scanOptions.serverUrl = hostUrl ?? scanOptions.serverUrl;
  // TODO: consider dropping logLevel at the scanOptions level
  // https://github.com/7PH/sonar-scanner-npm-mmf-3712-poc/pull/10#discussion_r1539210351
  scanOptions.logLevel = logLevel ?? scanOptions.logLevel;
  scanOptions.options = { ...DEFAULT_OPTIONS, ...scanOptions.options, ...parsedOptions };
  const { serverUrl } = scanOptions;

  setLogLevel(scanOptions.logLevel ?? DEFAULT_LOG_LEVEL);

  log(LogLevel.DEBUG, 'Scan options:', scanOptions);

  log(LogLevel.DEBUG, 'Fetch server version');
  const serverVersion = await fetchServerVersion(serverUrl);
  log(LogLevel.INFO, `Server version: ${serverVersion.toString()}`);

  log(LogLevel.DEBUG, 'Finding platform info');
  const platformInfo = getPlatformInfo();
  log(LogLevel.INFO, `Platform: ${JSON.stringify(platformInfo)}`);

  log(LogLevel.DEBUG, 'Fetch JRE path');
  const javaBinPath = await fetchJre(serverVersion, platformInfo, scanOptions);

  log(LogLevel.DEBUG, 'Java sanity check');
  if (!(await isJavaValid(javaBinPath))) {
    log(LogLevel.ERROR, 'Unable to find java.');
    throw new Error('Unable to find java.');
  }

  // Download / cache scanner engine
  log(LogLevel.DEBUG, 'fetchScannerEnginePath');
  const scannerEnginePath = await fetchScannerEngine(scanOptions);

  // Run scanner engine with downloaded java
  log(LogLevel.DEBUG, 'runScannerEngine');
  await runScannerEngine(javaBinPath, scannerEnginePath, scanOptions);
}
