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
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { defineSonarScannerParams } from './config';
import { SONAR_CACHE_DIR } from './constants';
import { downloadFile, getCachedFileLocation } from './download';
import { getHttpAgents } from './http-agent';
import { LogLevel, log } from './logging';
import { getProxyUrl, proxyUrlToJavaOptions } from './proxy';
import { ScanOptions } from './scan';
import { ScannerLogEntry } from './types';

export async function fetchScannerEngine(scanOptions: ScanOptions): Promise<string> {
  const { serverUrl } = scanOptions;

  const { data } = await axios.get(`${serverUrl}/batch/index`);
  const [filename, md5] = data.trim().split('|');
  log(LogLevel.DEBUG, `Scanner engine: ${filename} (md5: ${md5})`);

  const cachedScannerEngine = getCachedFileLocation(md5, filename);
  log(LogLevel.DEBUG, `Cached scanner engine: ${cachedScannerEngine}`);
  if (cachedScannerEngine) {
    log(LogLevel.INFO, `Using cached scanner engine: ${cachedScannerEngine}`);
    return cachedScannerEngine;
  }

  const proxyUrl = getProxyUrl(scanOptions);
  if (proxyUrl) {
    log(LogLevel.DEBUG, 'Proxy detected:', proxyUrl);
  }

  const scannerEnginePath = path.join(SONAR_CACHE_DIR, md5, filename);
  await downloadFile(
    `${serverUrl}/batch/file?name=${filename}`,
    scannerEnginePath,
    md5,
    getHttpAgents(proxyUrl, scanOptions.caPath),
  );
  return scannerEnginePath;
}

export async function logScannerOutput(logEntry: string) {
  try {
    const parsed = JSON.parse(logEntry) as ScannerLogEntry;
    log(parsed.level, 'ScannerEngine', parsed.formattedMessage);
    if (parsed.throwable) {
      // Console.log without newline
      process.stdout.write(parsed.throwable);
    }
  } catch (e) {
    process.stdout.write(logEntry);
  }
}

export function runScannerEngine(
  javaBinPath: string,
  scannerEnginePath: string,
  scanOptions: ScanOptions,
) {
  // Save the custom sonar.properties
  const scannerParams = defineSonarScannerParams(
    process.cwd(),
    scanOptions,
    process.env.SONARQUBE_SCANNER_PARAMS,
  );

  // the scanner engine expects a JSON object of properties attached to a key name "scannerProperties"
  const propertiesJSON = JSON.stringify({ scannerProperties: scannerParams });

  // Run the scanner-engine
  const scannerOptions = [
    ...(scanOptions.jvmOptions ?? []),
    ...proxyUrlToJavaOptions(scanOptions, getProxyUrl(scanOptions)),
    '-jar',
    scannerEnginePath,
  ];
  log(LogLevel.DEBUG, 'Running scanner engine', javaBinPath, ...scannerOptions);
  const scannerProcess = spawn(javaBinPath, scannerOptions);

  if (propertiesJSON) {
    log(LogLevel.DEBUG, 'Writing properties to scanner engine', propertiesJSON);
    scannerProcess.stdin.write(propertiesJSON);
    scannerProcess.stdin.end();
  }

  return new Promise<void>((resolve, reject) => {
    scannerProcess.stdout.on('data', data => {
      data.toString().split('\n').forEach(logScannerOutput);
    });
    scannerProcess.stderr.on('data', data => {
      log(LogLevel.ERROR, data.toString());
    });
    scannerProcess.on('exit', code => {
      if (code === 0) {
        log(LogLevel.INFO, 'Scanner engine finished successfully');
        resolve();
      } else {
        log(LogLevel.ERROR, `Scanner engine failed with code ${code}`);
        reject(new Error(`Scanner engine failed with code ${code}`));
      }
    });
  });
}
