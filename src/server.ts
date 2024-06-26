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
import semver, { SemVer } from 'semver';
import { LogLevel, log } from './logging';

export async function fetchServerVersion(serverUrl: string): Promise<SemVer> {
  try {
    log(LogLevel.DEBUG, 'Fetch URL: ', `${serverUrl}/api/server/version`);
    const { data } = await axios.get(`${serverUrl}/api/server/version`);
    log(LogLevel.DEBUG, 'Server version:', data);
    return semver.coerce(data) ?? data; // TODO: Do we want to fail when we can't get the server version? That'd make sense
  } catch (e) {
    log(LogLevel.ERROR, 'Failed to fetch server version');
    return Promise.reject(e);
  }
}
