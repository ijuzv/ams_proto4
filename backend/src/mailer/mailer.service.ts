import { Injectable } from '@nestjs/common';

type SendMailOptions = {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, any>;
};

@Injectable()
export class MailerService {
  async sendMail(options: SendMailOptions): Promise<boolean> {
    const { to, subject, template, context } = options;
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    
    console.log(`Sending email to: ${recipients}`);
    console.log(`Subject: ${subject}`);
    console.log(`Template: ${template}`);
    console.log('Context:', JSON.stringify(context, null, 2));
    
    // TODO: Implement actual email sending logic with a template engine
    return true;
  }
}
