import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  template: string;
  context?: Record<string, any>;
  text?: string;
  html?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    const { to, subject, template, context = {}, text, html } = options;
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    
    try {
      this.logger.log(`Preparing to send email to: ${recipients}`);
      
      let finalHtml = html;
      
      // If template is provided, try to load and compile it
      if (template) {
        try {
          const templatePath = path.join(
            __dirname,
            'templates',
            `${template}.hbs`
          );
          
          if (fs.existsSync(templatePath)) {
            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            const compiledTemplate = handlebars.compile(templateContent);
            finalHtml = compiledTemplate({
              ...context,
              currentYear: new Date().getFullYear(),
            });
          } else {
            this.logger.warn(`Template file not found: ${templatePath}`);
          }
        } catch (error) {
          this.logger.error(`Error loading template: ${error.message}`, error.stack);
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"Leave Management System" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
        to: recipients,
        subject,
        text: text || (finalHtml ? undefined : 'No message content'),
        html: finalHtml,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${recipients}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${recipients}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
