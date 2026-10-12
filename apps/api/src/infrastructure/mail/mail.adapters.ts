import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config';
import { MailMessage, MailPort } from './mail.port';

/** Desenvolvimento: registra o e-mail no log. */
@Injectable()
export class ConsoleMailAdapter extends MailPort {
  private readonly logger = new Logger('Mail');
  async send(message: MailMessage) {
    this.logger.log(`Para: ${message.to} | ${message.subject}\n${message.text}`);
  }
}

@Injectable()
export class SmtpMailAdapter extends MailPort {
  private readonly transporter: Transporter;
  constructor(private readonly config: AppConfig) {
    super();
    this.transporter = createTransport(config.mail.smtpUrl);
  }
  async send(message: MailMessage) {
    await this.transporter.sendMail({ from: this.config.mail.from, ...message });
  }
}
