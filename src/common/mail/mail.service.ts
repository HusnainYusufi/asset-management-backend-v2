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
    const link = this.buildLink('reset-password', payload.token);
    await this.transporter.sendMail({
      from: this.getSender(),
      to: payload.to,
      subject: 'Reset your password',
      text: `Hi ${payload.name},\n\nReset your password here: ${link}\n\nIf you did not request this, you can ignore it.`,
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
    return `${baseUrl.replace(/\\/$/, '')}/${path}?token=${token}`;
  }
}
