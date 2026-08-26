import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

function transportOptions() {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    requireTLS: env.SMTP_REQUIRE_TLS,
    connectionTimeout: env.SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: env.SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: env.SMTP_SOCKET_TIMEOUT_MS,
    ...(env.SMTP_FAMILY ? { family: env.SMTP_FAMILY } : {}),
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  };
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport(transportOptions());

  logger.info({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    requireTLS: env.SMTP_REQUIRE_TLS,
    connectionTimeoutMs: env.SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeoutMs: env.SMTP_GREETING_TIMEOUT_MS,
    socketTimeoutMs: env.SMTP_SOCKET_TIMEOUT_MS,
    family: env.SMTP_FAMILY ?? 'auto',
  }, 'SMTP transport configured');

  return transporter;
}

function discardTransport() {
  transporter?.close();
  transporter = null;
}

export function closeMailTransport() {
  discardTransport();
}

export async function verifyMailTransport() {
  const client = getTransporter();
  try {
    await client.verify();
    logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP greeting, TLS, and authentication verified');
  } catch (error) {
    discardTransport();
    throw error;
  }
}

export async function sendEmailMail(input: {
  emailId?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const client = getTransporter();
  logger.info({ emailId: input.emailId, host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP send started');
  try {
    const info = await client.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    logger.info({ emailId: input.emailId, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }, 'SMTP send succeeded');

    return { info, previewUrl };
  } catch (error) {
    discardTransport();
    const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
    logger.error({ error, errorCode }, 'SMTP send failed');
    throw error;
  }
}

export function isRetryableSmtpError(error: unknown) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  const responseCode = error instanceof Error && 'responseCode' in error ? Number(error.responseCode) : undefined;
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE', 'ESOCKET'].includes(code)
    || (responseCode !== undefined && responseCode >= 400 && responseCode < 500);
}
