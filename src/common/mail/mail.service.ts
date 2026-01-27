import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

interface InvitationEmailPayload {
  to: string;
  name: string;
  token: string;
  clientName: string;
}

interface PasswordResetPayload {
  to: string;
  name: string;
  token: string;
}

interface ExpirationReminderPayload {
  to: string;
  name: string;
  assetName: string;
  daysUntilExpiry: number;
  clientName: string;
  showroomName?: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = this.createTransporter();
  }

  async sendInvitationEmail(payload: InvitationEmailPayload) {
    const link = this.buildLink('accept-invite', payload.token);
    await this.transporter.sendMail({
      from: this.getSender(),
      to: payload.to,
      subject: `You're invited to ${payload.clientName}`,
      text: `Hi ${payload.name},\n\nYou've been invited to ${payload.clientName}. Set your password here: ${link}\n\nIf you did not expect this email, you can ignore it.`,
    });
  }

  async sendPasswordResetEmail(payload: PasswordResetPayload) {
    await this.transporter.sendMail({
      from: this.getSender(),
      to: payload.to,
      subject: 'Reset your password',
      text: `Hi ${payload.name},\n\nYour password reset code is: ${payload.token}\n\nIf you did not request this, you can ignore it.`,
    });
  }

  async sendExpirationReminderEmail(payload: ExpirationReminderPayload) {
    const { to, name, assetName, daysUntilExpiry, clientName, showroomName } =
      payload;

    const locationText = showroomName
      ? `in showroom "${showroomName}" of ${clientName}`
      : `in ${clientName}`;

    const subject =
      daysUntilExpiry === 0
        ? `[URGENT] "${assetName}" expires TODAY!`
        : `Reminder: "${assetName}" expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`;

    const expiryText =
      daysUntilExpiry === 0
        ? 'TODAY'
        : `in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`;

    const text = `Hi ${name},

This is a reminder that the asset "${assetName}" ${locationText} will expire ${expiryText}.

Please take action to renew the subscription or update the credentials.

Best regards,
Asset Management System`;

    await this.transporter.sendMail({
      from: this.getSender(),
      to,
      subject,
      text,
    });
  }

  private createTransporter() {
    const host = this.configService.get<string>('HOST');
    const port = Number(this.configService.get<string>('MAIL_PORT') ?? 465);
    const user =
      this.configService.get<string>('MAIL_USER') ??
      this.configService.get<string>('GMAIL_USER');
    const pass =
      this.configService.get<string>('MAIL_PASSWORD') ??
      this.configService.get<string>('GMAIL_PASSWORD');

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private getSender() {
    return (
      this.configService.get<string>('MAIL_USER') ??
      this.configService.get<string>('GMAIL_USER') ??
      'no-reply@asset-management.local'
    );
  }

  private buildLink(path: string, token: string) {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('BASE_URL') ??
      'http://localhost:3000';
    return `${baseUrl.replace(/\/$/, '')}/${path}?token=${token}`;
  }
}
