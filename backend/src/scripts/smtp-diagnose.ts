import { lookup } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { env } from '../config/env.js';

type SmtpSocket = net.Socket | tls.TLSSocket;

function errorDetails(error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  return { error: typeof value.code === 'string' ? value.code : 'UNKNOWN', message: typeof value.message === 'string' ? value.message : 'Unknown SMTP diagnostic failure' };
}

function printResult(phase: string, passed: boolean, details: Record<string, unknown> = {}) {
  console.log(`SMTP ${phase}: ${passed ? 'PASS' : 'FAIL'}`);
  for (const [key, value] of Object.entries(details)) console.log(`${key}=${String(value)}`);
}

function response(socket: SmtpSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error('SMTP response timed out'), { code: 'ETIMEDOUT' })); }, env.SMTP_GREETING_TIMEOUT_MS);
    const cleanup = () => { clearTimeout(timer); socket.off('data', onData); socket.off('error', onError); socket.off('close', onClose); };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const line = buffer.split(/\r?\n/).find((value) => /^\d{3} /.test(value));
      if (line) { cleanup(); resolve(line); }
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error('SMTP socket closed before response')); };
    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

async function command(socket: SmtpSocket, value: string) {
  socket.write(`${value}\r\n`);
  const line = await response(socket);
  if (!/^[23]\d\d /.test(line)) throw Object.assign(new Error(line), { code: `SMTP_${line.slice(0, 3)}` });
}

async function tcpConnect() {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ host: env.SMTP_HOST, port: env.SMTP_PORT, family: env.SMTP_FAMILY });
    const timer = setTimeout(() => { socket.destroy(); reject(Object.assign(new Error('SMTP TCP connection timed out'), { code: 'ETIMEDOUT' })); }, env.SMTP_CONNECTION_TIMEOUT_MS);
    socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

async function main() {
  console.log(`SMTP diagnostic host=${env.SMTP_HOST} port=${env.SMTP_PORT} secure=${env.SMTP_SECURE ?? env.SMTP_PORT === 465} requireTLS=${env.SMTP_REQUIRE_TLS}`);
  try {
    const addresses = await lookup(env.SMTP_HOST, { all: true, family: env.SMTP_FAMILY });
    printResult('DNS', true, { host: env.SMTP_HOST, addresses: addresses.map((address) => address.address).join(',') });
  } catch (error) {
    printResult('DNS', false, { phase: 'dns-lookup', ...errorDetails(error) }); process.exitCode = 1; return;
  }

  let socket: SmtpSocket;
  try {
    socket = await tcpConnect();
    printResult('TCP', true, { host: env.SMTP_HOST, port: env.SMTP_PORT });
  } catch (error) {
    printResult('TCP', false, { host: env.SMTP_HOST, port: env.SMTP_PORT, phase: 'tcp-connect', ...errorDetails(error) }); process.exitCode = 1; return;
  }

  let phase = 'greeting';
  try {
    if (env.SMTP_SECURE) {
      const secureSocket = tls.connect({ host: env.SMTP_HOST, port: env.SMTP_PORT, servername: env.SMTP_HOST });
      await new Promise<void>((resolve, reject) => { secureSocket.once('secureConnect', resolve); secureSocket.once('error', reject); });
      socket = secureSocket;
    }
    const greeting = await response(socket);
    if (!/^220 /.test(greeting)) throw new Error(greeting);
    printResult('greeting', true);
    await command(socket, `EHLO ${env.SMTP_HOST}`);
    if (!env.SMTP_SECURE && env.SMTP_REQUIRE_TLS) {
      phase = 'STARTTLS';
      await command(socket, 'STARTTLS');
      const secureSocket = tls.connect({ socket: socket as net.Socket, servername: env.SMTP_HOST });
      await new Promise<void>((resolve, reject) => { secureSocket.once('secureConnect', resolve); secureSocket.once('error', reject); });
      socket = secureSocket;
      printResult('STARTTLS', true);
      await command(socket, `EHLO ${env.SMTP_HOST}`);
    }
    phase = 'authentication';
    await command(socket, 'AUTH LOGIN');
    await command(socket, Buffer.from(env.SMTP_USER).toString('base64'));
    await command(socket, Buffer.from(env.SMTP_PASSWORD).toString('base64'));
    printResult('authentication', true, { user: `${env.SMTP_USER.slice(0, 2)}***` });
    await command(socket, 'QUIT');
    socket.end();
  } catch (error) {
    const details = errorDetails(error);
    printResult(phase, false, { phase, ...details }); process.exitCode = 1; socket.destroy();
  }
}

void main();
