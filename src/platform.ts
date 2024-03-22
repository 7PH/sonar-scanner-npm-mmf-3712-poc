import fs from 'fs';
import { LogLevel, log } from './logging';
import { PlatformInfo, SupportedOS } from './types';

/**
 * @see https://github.com/microsoft/vscode/blob/64874113ad3c59e8d045f75dc2ef9d33d13f3a03/src/vs/platform/extensionManagement/common/extensionManagementUtil.ts#L171C1-L190C1
 */
function isAlpineLinux(): boolean {
  if (process.platform !== 'linux') {
    return false;
  }
  let content: string | undefined;
  try {
    const fileContent = fs.readFileSync('/etc/os-release');
    content = fileContent.toString();
  } catch (error) {
    try {
      const fileContent = fs.readFileSync('/usr/lib/os-release');
      content = fileContent.toString();
    } catch (error) {
      /* Ignore */
      log(LogLevel.WARN, 'Failed to read /etc/os-release or /usr/lib/os-release');
    }
  }
  return !!content && (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === 'alpine';
}

function getSupportedOS(): SupportedOS {
  const mapping: { [nodePlatform: string]: SupportedOS } = {
    linux: isAlpineLinux() ? 'alpine' : 'linux',
    // TODO: Check whether these aliases are necessary
    openbsd: 'linux',
    sunos: 'linux',
    freebsd: 'linux',
    aix: 'aix',
  };
  return mapping[process.platform] ?? process.platform;
}

export function getPlatformInfo(): PlatformInfo {
  return {
    os: getSupportedOS(),
    arch: process.arch,
  };
}
