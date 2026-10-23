import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private oauth2Client: OAuth2Client | null = null;
  private isConfigured = false;
  private senderEmail: string;

  constructor() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    this.senderEmail = process.env.GMAIL_SENDER_EMAIL || 'oceanvision.alerts@gmail.com';

    if (clientId && clientSecret && refreshToken) {
      try {
        this.oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
        );
        this.oauth2Client.setCredentials({ refresh_token: refreshToken });
        this.isConfigured = true;
        this.logger.log(`Gmail API Client initialized for sender: ${this.senderEmail}`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize Gmail OAuth2 Client: ${err.message}`);
      }
    } else {
      this.logger.warn(
        'Gmail API credentials not fully set in .env (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN). Running in Simulated Mailer mode.',
      );
    }
  }

  /**
   * Constructs an RFC 2822 compliant MIME email and encodes it in URL-safe Base64.
   */
  private createMimeMessage(to: string, subject: string, htmlBody: string): string {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `From: "Ocean Vision Security" <${this.senderEmail}>`,
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      htmlBody,
    ];
    const message = messageParts.join('\n');
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Sends an email via official Google Gmail API v1.
   */
  async sendEmail(to: string, subject: string, htmlBody: string): Promise<{ success: boolean; messageId?: string; simulated?: boolean }> {
    if (!this.isConfigured || !this.oauth2Client) {
      this.logger.log(`[SIMULATED GMAIL] To: ${to} | Subject: "${subject}" | Content length: ${htmlBody.length} chars`);
      return {
        success: true,
        messageId: `sim-msg-${Date.now()}`,
        simulated: true,
      };
    }

    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const raw = this.createMimeMessage(to, subject, htmlBody);

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      this.logger.log(`[GMAIL API] Email sent successfully to ${to}. MessageId: ${res.data.id}`);
      return {
        success: true,
        messageId: res.data.id || undefined,
        simulated: false,
      };
    } catch (err: any) {
      this.logger.error(`[GMAIL API ERROR] Failed to send email to ${to}: ${err.message}`, err.stack);
      return {
        success: false,
        simulated: false,
      };
    }
  }

  /**
   * High-priority security alert: Unauthorized human detection in low-light / night conditions.
   */
  async sendIntruderAlert(deviceId: string, confidence: number, lux: number, targetEmail?: string) {
    const recipient = targetEmail || process.env.ADMIN_ALERT_EMAIL || this.senderEmail;
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const subject = `[CẢNH BÁO AN NINH] Phát hiện đối tượng ban đêm - ${deviceId}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #061426; color: #e2e8f0; padding: 24px; border-radius: 12px; border: 1px solid #163859; max-width: 600px; margin: 0 auto;">
        <div style="border-bottom: 2px solid #22D3EE; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="color: #22D3EE; margin: 0; font-size: 20px;">OCEAN VISION — CẢNH BÁO AN NINH BAN ĐÊM</h2>
          <span style="font-size: 12px; color: #94a3b8;">Thời gian: ${timeStr} (Asia/Ho_Chi_Minh)</span>
        </div>

        <div style="background-color: #091c33; padding: 16px; border-radius: 8px; border: 1px solid #0e294b; margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Thiết bị:</strong> <span style="color: #22D3EE;">${deviceId}</span></p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Nhận diện:</strong> <span style="color: #ef4444; font-weight: bold;">CON NGƯỜI (PERSON)</span></p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Độ chính xác AI (TurboQuant INT4):</strong> <span style="color: #10b981;">${(confidence * 100).toFixed(1)}%</span></p>
          <p style="margin: 0; font-size: 14px;"><strong>Độ rọi môi trường (Lux):</strong> <span style="color: #f59e0b;">${lux.toFixed(1)} lux (Ban đêm/Phòng tối)</span></p>
        </div>

        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0 0 16px 0;">
          Khung hình đã được chuyển trực tiếp vào MongoDB GridFS an toàn (Zero-Client Persistence). Truy cập Web Dashboard để xem xét hoặc kích hoạt chụp cưỡng bức.
        </p>

        <a href="${process.env.APP_URL || 'http://localhost:5173'}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #2dd4bf); color: #040d18; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px;">
          Mở Dashboard Giám Sát
        </a>
      </div>
    `;

    return this.sendEmail(recipient, subject, html);
  }

  /**
   * Automated retention purge report.
   */
  async sendRetentionReport(purgedCount: number, freedBytes: number, targetEmail?: string) {
    const recipient = targetEmail || process.env.ADMIN_ALERT_EMAIL || this.senderEmail;
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const mbFreed = (freedBytes / (1024 * 1024)).toFixed(2);
    const subject = `[BÁO CÁO DỌN DẸP] Tự động xóa ${purgedCount} ảnh hết hạn - Ocean Vision`;

    const html = `
      <div style="font-family: sans-serif; background-color: #061426; color: #e2e8f0; padding: 20px; border-radius: 10px; max-width: 550px;">
        <h3 style="color: #2DD4BF; margin-top: 0;">BÁO CÁO DỌN DẸP ĐỊNH KỲ (RETENTION PURGE)</h3>
        <p style="font-size: 13px; color: #94a3b8;">Thời điểm dọn dẹp: ${timeStr}</p>
        <p>Hệ thống vừa thực hiện dọn dẹp ảnh quá hạn lưu trữ khỏi MongoDB GridFS:</p>
        <ul>
          <li>Số lượng ảnh đã xóa: <strong>${purgedCount}</strong> ảnh</li>
          <li>Dung lượng giải phóng: <strong>${mbFreed} MB</strong></li>
          <li>Audit Log: Đã lưu vết xóa an toàn, không rò rỉ binary.</li>
        </ul>
      </div>
    `;

    return this.sendEmail(recipient, subject, html);
  }
}

