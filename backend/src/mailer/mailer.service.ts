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
    // Register Handlebars helpers
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('ne', (a, b) => a !== b);
    handlebars.registerHelper('gt', (a, b) => a > b);
    handlebars.registerHelper('lt', (a, b) => a < b);
    handlebars.registerHelper('gte', (a, b) => a >= b);
    handlebars.registerHelper('lte', (a, b) => a <= b);

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
          // Try dist folder first (production), then src folder (development)
          const distTemplatePath = path.join(
            __dirname,
            'templates',
            `${template}.hbs`
          );
          
          const srcTemplatePath = path.join(
            process.cwd(),
            'src',
            'mailer',
            'templates',
            `${template}.hbs`
          );
          
          let templatePath = distTemplatePath;
          if (!fs.existsSync(templatePath)) {
            templatePath = srcTemplatePath;
          }
          
          if (fs.existsSync(templatePath)) {
            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            const compiledTemplate = handlebars.compile(templateContent);
            finalHtml = compiledTemplate({
              ...context,
              currentYear: new Date().getFullYear(),
            });
            this.logger.log(`Template loaded from: ${templatePath}`);
          } else {
            this.logger.warn(`Template file not found in either location. Tried: ${distTemplatePath} and ${srcTemplatePath}`);
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
