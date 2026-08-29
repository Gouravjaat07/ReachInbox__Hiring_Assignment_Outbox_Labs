import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

export function smtpErrorDetails(error: unknown) {
  const value = error as {
    code?: unknown;
    responseCode?: unknown;
    command?: unknown;
    message?: unknown;
    response?: unknown;
  };

  const response = value.response;

  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    responseCode: typeof value.responseCode === 'number' ? value.responseCode : undefined,
    command: typeof value.command === 'string' ? value.command : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
    response: typeof response === 'string'
      ? response
      : response instanceof Buffer
        ? response.toString('utf8')
        : response !== undefined
          ? String(response)
          : undefined,
  };
}

function smtpTransportOptions() {
  const isStartTlsPort = env.SMTP_PORT === 587;
  const secure = isStartTlsPort ? false : env.SMTP_SECURE ?? env.SMTP_PORT === 465;

  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure,
    requireTLS: isStartTlsPort ? true : env.SMTP_REQUIRE_TLS,
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

  transporter = nodemailer.createTransport(smtpTransportOptions());

  const transportConfig = smtpTransportOptions();
  logger.info({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: transportConfig.secure,
    requireTLS: transportConfig.requireTLS,
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
    const details = smtpErrorDetails(error);
    const phase = details.command === 'CONN' || ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE', 'ESOCKET'].includes(details.code ?? '')
      ? 'connection'
      : details.code === 'EAUTH' || details.responseCode === 535
        ? 'authentication'
        : details.responseCode !== undefined
          ? 'smtp'
          : 'unknown';
    logger.warn({
      dependency: 'smtp',
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      code: details.code,
      responseCode: details.responseCode,
      command: details.command,
      message: details.message,
      response: details.response,
      phase,
    }, 'SMTP startup verification failed; outbound SMTP connectivity is unavailable from this runtime');
    throw error;
  }
}

export async function sendEmailMail(input: {
  emailId?: string;
  attempt?: number;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const client = getTransporter();
  logger.info({ emailId: input.emailId, attempt: input.attempt, host: env.SMTP_HOST, port: env.SMTP_PORT }, 'SMTP send started');
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
    const details = smtpErrorDetails(error);
    const phase = details.command === 'CONN' || ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE', 'ESOCKET'].includes(details.code ?? '')
      ? 'connection'
      : details.code === 'EAUTH' || details.responseCode === 535
        ? 'authentication'
        : details.responseCode !== undefined
          ? 'smtp'
          : 'unknown';
    logger.error({
      emailId: input.emailId,
      attempt: input.attempt,
      code: details.code,
      responseCode: details.responseCode,
      command: details.command,
      message: details.message,
      response: details.response,
      phase,
    }, 'SMTP send failed');
    throw error;
  }
}

export function isRetryableSmtpError(error: unknown) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  const responseCode = error instanceof Error && 'responseCode' in error ? Number(error.responseCode) : undefined;
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE', 'ESOCKET'].includes(code)
    || (responseCode !== undefined && responseCode >= 400 && responseCode < 500);
}
