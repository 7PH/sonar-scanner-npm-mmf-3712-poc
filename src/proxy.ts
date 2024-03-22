import { getProxyForUrl } from 'proxy-from-env';
import { URL } from 'url';
import { ScanOptions } from './scan';

export function getProxyUrl(scanOptions: ScanOptions): URL | undefined {
  const options = scanOptions.options;
  if (options) {
    // TODO: Type the options object or use constants for bootstrapper-specific values
    const proxyHost = options['sonar.scanner.proxyHost'];
    const proxyPort = options['sonar.scanner.proxyPort'];
    const proxyUser = options['sonar.scanner.proxyUser'];
    const proxyPassword = options['sonar.scanner.proxyPassword'];
    const proxyTls = options['sonar.scanner.proxyTls'] ?? 'false';

    if (proxyHost) {
      const protocol = proxyTls === 'true' ? 'https' : 'http';
      return new URL(`${protocol}://${proxyUser}:${proxyPassword}@${proxyHost}:${proxyPort}`);
    }
  }

  const proxy = getProxyForUrl(scanOptions.serverUrl);
  if (proxy) {
    return new URL(proxy);
  }

  return undefined;
}

export function proxyUrlToJavaOptions(scanOptions: ScanOptions, proxyUrl?: URL): string[] {
  if (!proxyUrl) {
    return [];
  }

  const protocol = scanOptions.serverUrl.startsWith('https') ? 'https' : 'http';
  return [
    `-D${protocol}.proxyHost=${proxyUrl.hostname}`,
    `-D${protocol}.proxyPort=${proxyUrl.port}`,
    `-D${protocol}.proxyUser=${proxyUrl.username}`,
    `-D${protocol}.proxyPassword=${proxyUrl.password}`,
  ];
}
