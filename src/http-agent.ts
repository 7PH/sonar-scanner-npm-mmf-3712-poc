import { AxiosRequestConfig } from 'axios';
import fs from 'fs';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import https from 'https';

export function getHttpAgents(
  proxyUrl?: URL,
  caPath?: string,
): Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'> {
  const agents: Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'> = {};

  const ca = caPath ? fs.readFileSync(caPath) : undefined;

  if (proxyUrl) {
    agents.httpsAgent = new HttpsProxyAgent({ proxy: proxyUrl.toString(), ca });
    agents.httpAgent = new HttpProxyAgent({ proxy: proxyUrl.toString() });
  } else if (caPath) {
    agents.httpsAgent = new https.Agent({ ca });
  }
  return agents;
}
