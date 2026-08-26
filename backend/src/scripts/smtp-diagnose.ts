import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env.js';
import { closeMailTransport, verifyMailTransport } from '../services/mail.service.js';
import { logger } from '../utils/logger.js';

async function checkTcpConnection() {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: env.SMTP_HOST, port: env.SMTP_PORT, family: env.SMTP_FAMILY });
    const timeout = setTimeout(() => {
      socket.destroy(new Error('SMTP TCP connection timed out'));
    }, env.SMTP_CONNECTION_TIMEOUT_MS);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function main() {
  logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465, requireTLS: env.SMTP_REQUIRE_TLS }, 'Starting SMTP diagnostic');
  const addresses = await lookup(env.SMTP_HOST, { all: true, family: env.SMTP_FAMILY });
  logger.info({ host: env.SMTP_HOST, addresses: addresses.map((address) => address.address) }, 'SMTP DNS resolution succeeded');

  await checkTcpConnection();
  logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP TCP connection succeeded');

  await verifyMailTransport();
  logger.info('SMTP STARTTLS/authentication diagnostic succeeded');
}

main().catch((error) => {
  const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
  logger.fatal({ error, errorCode, host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP diagnostic failed');
  process.exitCode = 1;
}).finally(() => {
  closeMailTransport();
});
