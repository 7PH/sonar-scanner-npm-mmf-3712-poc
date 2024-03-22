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
import path from 'path';
import semver, { SemVer } from 'semver';
import {
  SONARCLOUD_URL,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
  SONAR_CACHE_DIR,
  UNARCHIVE_SUFFIX,
} from './constants';
import { allowExecution, downloadFile, extractArchive, getCachedFileLocation } from './download';
import { getHttpAgents } from './http-agent';
import { LogLevel, log } from './logging';
import { getProxyUrl } from './proxy';
import { ScanOptions } from './scan';
import { JreMetaData, PlatformInfo } from './types';

function supportsJreProvisioning(serverUrl: string, serverVersion: SemVer) {
  // TODO: Is this acceptable? This won't work on squad environments (ok we could use regexp match but still, is this acceptable?)
  if (serverUrl === SONARCLOUD_URL) {
    log(LogLevel.DEBUG, 'SonarCloud detected, and SonarCloud always supports JRE provisioning');
    return true;
  }

  const supports = semver.satisfies(serverVersion, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${serverVersion} supports JRE provisioning: ${supports}`);
  return supports;
}

async function downloadJre(
  platformInfo: PlatformInfo,
  scanOptions: ScanOptions,
): Promise<
  JreMetaData & {
    jrePath: string;
  }
> {
  const { data } = await axios.get<JreMetaData>(
    `${scanOptions.serverUrl}/api/v2/scanner/jre/info?os=${platformInfo.os}&arch=${platformInfo.arch}`,
  );

  // If the JRE was already downloaded, we can skip the download
  const cachedJRE = getCachedFileLocation(data.checksum, data.filename + UNARCHIVE_SUFFIX);
  if (cachedJRE) {
    log(LogLevel.DEBUG, `JRE already downloaded to ${cachedJRE}. Skipping download`);
    return {
      ...data,
      jrePath: path.join(cachedJRE, data.javaPath),
    };
  }

  const archivePath = path.join(SONAR_CACHE_DIR, data.checksum, data.filename);
  const jreDirPath = path.join(SONAR_CACHE_DIR, data.checksum, data.filename + UNARCHIVE_SUFFIX);

  const proxyUrl = getProxyUrl(scanOptions);
  if (proxyUrl) {
    log(LogLevel.DEBUG, 'Proxy detected:', proxyUrl);
  }

  await downloadFile(
    `${scanOptions.serverUrl}/api/v2/scanner/jre/download?filename=${data.filename}`,
    archivePath,
    data.checksum,
    getHttpAgents(proxyUrl, scanOptions.caPath),
  );
  await extractArchive(archivePath, jreDirPath);

  const jreBinPath = path.join(jreDirPath, data.javaPath);
  log(LogLevel.DEBUG, `JRE downloaded to ${jreDirPath}. Allowing execution on ${jreBinPath}`);
  // TODO: check if this is needed, we can also check the file permissions before
  allowExecution(jreBinPath);

  return {
    ...data,
    jrePath: jreBinPath,
  };
}

export async function fetchJre(
  serverVersion: SemVer,
  platformInfo: PlatformInfo,
  scanOptions: ScanOptions,
): Promise<string> {
  if (supportsJreProvisioning(scanOptions.serverUrl, serverVersion)) {
    const { jrePath } = await downloadJre(platformInfo, scanOptions);
    return jrePath;
  }

  // TODO: Sanity check?

  // TODO: Check that this is acceptable
  return 'java';
}
