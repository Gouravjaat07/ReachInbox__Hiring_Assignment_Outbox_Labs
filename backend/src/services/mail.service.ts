import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

export async function verifyMailTransport() {
  const client = getTransporter();
  await client.verify();
  logger.info('SMTP transport verified');
}

export async function sendEmailMail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const client = getTransporter();
  logger.info('SMTP send started');
  const info = await client.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  logger.info({ messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }, 'SMTP send succeeded');

  return { info, previewUrl };
}
