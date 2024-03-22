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
  SONARCLOUD_ENV_REGEX,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
  SONAR_CACHE_DIR,
  UNARCHIVE_SUFFIX,
} from './constants';
import { downloadFile, extractArchive, getCachedFileLocation } from './download';
import { getHttpAgents } from './http-agent';
import { LogLevel, log } from './logging';
import { getProxyUrl } from './proxy';
import { ScanOptions } from './scan';
import { JreMetaData, PlatformInfo } from './types';

function supportsJreProvisioning(serverUrl: string, serverVersion: SemVer) {
  if (SONARCLOUD_ENV_REGEX.test(serverUrl)) {
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
    `${scanOptions.serverUrl}/api/v2/analysis/jres?os=${platformInfo.os}&arch=${platformInfo.arch}`,
  );

  // If the JRE was already downloaded, we can skip the download
  const cachedJRE = getCachedFileLocation(data.md5, data.filename + UNARCHIVE_SUFFIX);
  if (cachedJRE) {
    log(LogLevel.DEBUG, `JRE already downloaded to ${cachedJRE}. Skipping download.`);
    return {
      ...data,
      jrePath: path.join(cachedJRE, data.javaPath),
    };
  }

  const archivePath = path.join(SONAR_CACHE_DIR, data.md5, data.filename);
  const jreDirPath = path.join(SONAR_CACHE_DIR, data.md5, data.filename + UNARCHIVE_SUFFIX);

  const proxyUrl = getProxyUrl(scanOptions);
  if (proxyUrl) {
    log(LogLevel.DEBUG, 'Proxy detected:', proxyUrl);
  }

  await downloadFile(
    `${scanOptions.serverUrl}/api/v2/analysis/jres/${data.filename}`,
    archivePath,
    data.md5,
    getHttpAgents(proxyUrl, scanOptions.caPath),
  );
  await extractArchive(archivePath, jreDirPath);

  const jreBinPath = path.join(jreDirPath, data.javaPath);
  log(LogLevel.DEBUG, `JRE downloaded to ${jreDirPath}. Allowing execution on ${jreBinPath}`);

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
  return new Promise(async (resolve, reject) => {
    try {
      if (supportsJreProvisioning(scanOptions.serverUrl, serverVersion)) {
        const { jrePath } = await downloadJre(platformInfo, scanOptions);
        resolve(jrePath);
      } else {
        log(LogLevel.WARN, 'JRE Provisioning not supported. Using java from path.');
        resolve('java');
      }
    } catch (error) {
      log(LogLevel.ERROR, 'Failed to fetch JRE', error);
      log(LogLevel.WARN, 'Using java from path.');
      resolve('java');
    }
  });
}
