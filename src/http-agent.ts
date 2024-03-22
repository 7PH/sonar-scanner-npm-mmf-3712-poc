import { AxiosRequestConfig } from 'axios';
import fs from 'fs';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import https from 'https';
import { getProxyForUrl } from 'proxy-from-env';

export function getHttpAgents(targetUrl: string, caPath?: string) {
  const agents: Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'> = {};

  const ca = caPath ? fs.readFileSync(caPath) : undefined;

  const proxy = getProxyForUrl(targetUrl);
  if (proxy) {
    agents.httpsAgent = new HttpsProxyAgent({ proxy, ca });
    agents.httpAgent = new HttpProxyAgent({ proxy });
  } else if (caPath) {
    agents.httpsAgent = new https.Agent({ ca });
  }
  return agents;
}
