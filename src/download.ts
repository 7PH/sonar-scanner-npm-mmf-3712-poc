import AdmZip from 'adm-zip';
import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import * as fsExtra from 'fs-extra';
import path, { dirname, join } from 'path';
import * as stream from 'stream';
import tarStream from 'tar-stream';
import { promisify } from 'util';
import zlib from 'zlib';
import { SONAR_CACHE_DIR } from './constants';
import { LogLevel, log } from './logging';

const finished = promisify(stream.finished);

/**
 * TODO: Compute checksum without re-reading the file
 */
function generateChecksum(filepath: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(crypto.createHash('md5').update(data).digest('hex'));
    });
  });
}

export async function downloadFile(
  url: string,
  destPath: string,
  expectedChecksum?: string,
  options?: Partial<AxiosRequestConfig>,
) {
  // Create destination directory if it doesn't exist
  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  log(LogLevel.INFO, `Downloaded ${url} to ${destPath}`);
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    responseType: 'stream',
    method: 'get',
    ...options,
  });
  response.data.pipe(writer);

  await finished(writer);

  if (expectedChecksum) {
    log(LogLevel.INFO, `Verifying checksum ${expectedChecksum}`);
    const checksum = await generateChecksum(destPath);
    if (checksum !== expectedChecksum) {
      throw new Error(
        `Checksum verification failed for ${destPath}. Expected checksum ${expectedChecksum} but got ${checksum}`,
      );
    }
  }
}

export async function extractArchive(archivePath: string, destPath: string) {
  if (archivePath.endsWith('.tar.gz')) {
    const tarFilePath = archivePath;
    const targetDirectory = destPath;
    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        const filePath = join(targetDirectory, header.name);
        // Ensure the directory exists
        await fsExtra.ensureDir(dirname(filePath));

        stream.pipe(fs.createWriteStream(filePath));

        stream.on('end', function () {
          next(); // ready for next entry
        });

        stream.resume(); // just auto drain the stream
      });

      extract.on('finish', () => {
        log(LogLevel.INFO, 'tar.gz Extraction complete');
        resolve(null);
      });

      extract.on('error', err => {
        log(LogLevel.ERROR, 'Error extracting tar.gz', err);
        reject(err);
      });
    });

    fs.createReadStream(tarFilePath).pipe(zlib.createGunzip()).pipe(extract);

    await extractionPromise;
  } else {
    log(LogLevel.INFO, `Extracting ${archivePath} to ${destPath}`);
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(destPath, true);
  }
}

export function getCachedFileLocation(md5: string, filename: string): string | null {
  const filePath = path.join(SONAR_CACHE_DIR, md5, filename);
  if (fs.existsSync(path.join(SONAR_CACHE_DIR, md5, filename))) {
    return filePath;
  }
  return null;
}
