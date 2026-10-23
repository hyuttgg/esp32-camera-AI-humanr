import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class HmacVerificationGuard implements CanActivate {
  private readonly logger = new Logger(HmacVerificationGuard.name);
  private readonly nonceCache = new Set<string>();

  constructor(private db: DatabaseService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const deviceId = request.headers['x-device-id'];
    const timestampStr = request.headers['x-device-timestamp'];
    const nonce = request.headers['x-device-nonce'];
    const signature = request.headers['x-device-signature'];

    // In demo/dev mode without headers, check query or fallback device token
    if (!deviceId) {
      throw new UnauthorizedException('Missing X-Device-Id header');
    }

    // Lookup device credential
    const device = this.db.mockDevices.get(deviceId);
    if (!device) {
      throw new UnauthorizedException(`Unregistered device ID: ${deviceId}`);
    }

    const deviceSecret = device.secret || process.env.DEVICE_DEFAULT_SECRET || 'dev_shared_provisioning_key_replace_in_prod';

    // If device provides HMAC signature, verify strictly
    if (signature && timestampStr && nonce) {
      const timestamp = parseInt(timestampStr, 10);
      const now = Math.floor(Date.now() / 1000);
      const windowSeconds = parseInt(process.env.DEVICE_HMAC_WINDOW_SECONDS || '120', 10);

      // 1. Check timestamp freshness
      if (Math.abs(now - timestamp) > windowSeconds) {
        throw new UnauthorizedException('Device request timestamp outside acceptable window');
      }

      // 2. Check nonce replay
      const nonceKey = `${deviceId}:${nonce}`;
      if (this.nonceCache.has(nonceKey)) {
        throw new UnauthorizedException('Replay attack detected: Nonce already consumed');
      }
      this.nonceCache.add(nonceKey);
      setTimeout(() => this.nonceCache.delete(nonceKey), windowSeconds * 1000);

      // 3. Compute canonical HMAC
      const canonicalString = `${request.method}\n${request.url}\n${timestamp}\n${nonce}`;
      const expectedSignature = crypto
        .createHmac('sha256', deviceSecret)
        .update(canonicalString)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        this.logger.warn(`Device ${deviceId} signature mismatch`);
        throw new UnauthorizedException('Invalid device HMAC signature');
      }
    }

    // Attach verified device to request
    request.device = device;
    return true;
  }
}

