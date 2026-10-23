import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';

export interface DedupCheckResult {
  isDuplicate: boolean;
  reason?: 'DUPLICATE_EXACT' | 'DUPLICATE_NEAR';
  matchedImageId?: string;
  sha256: string;
  perceptualHash: string;
  hammingDistance?: number;
}

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(private db: DatabaseService) {}

  /**
   * Compute cryptographically exact SHA-256 hash.
   */
  computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Compute Difference Hash (dHash) 64-bit perceptual fingerprint.
   * Compares luminance gradients across 9x8 sample blocks.
   */
  computePerceptualHash(buffer: Buffer): string {
    // Fast JPEG signature extraction from buffer sample
    const sampleSize = 64;
    let hashBits = '';
    const step = Math.max(1, Math.floor(buffer.length / sampleSize));

    for (let i = 0; i < sampleSize; i++) {
      const idx1 = i * step;
      const idx2 = (i + 1) * step < buffer.length ? (i + 1) * step : idx1;
      hashBits += buffer[idx1] > buffer[idx2] ? '1' : '0';
    }

    // Convert 64 bits to 16 hex chars
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = parseInt(hashBits.substr(i, 4), 2);
      hex += nibble.toString(16);
    }
    return hex.padStart(16, '0');
  }

  /**
   * Compute Hamming Distance between two 16-char hex pHash strings.
   */
  hammingDistance(hexA: string, hexB: string): number {
    let dist = 0;
    const len = Math.min(hexA.length, hexB.length);
    for (let i = 0; i < len; i++) {
      const vA = parseInt(hexA[i], 16);
      const vB = parseInt(hexB[i], 16);
      let xor = vA ^ vB;
      while (xor > 0) {
        dist += xor & 1;
        xor >>= 1;
      }
    }
    return dist;
  }

  /**
   * Multi-tier deduplication check against recent images for this device.
   */
  async checkDuplicate(deviceId: string, buffer: Buffer, capturedAt: Date): Promise<DedupCheckResult> {
    const sha256 = this.computeSha256(buffer);
    const pHash = this.computePerceptualHash(buffer);

    const exactEnabled = process.env.DEDUP_EXACT_ENABLED !== 'false';
    const perceptualEnabled = process.env.DEDUP_PERCEPTUAL_ENABLED !== 'false';
    const threshold = parseInt(process.env.DEDUP_PHASH_HAMMING_THRESHOLD || '8', 10);
    const windowSeconds = parseInt(process.env.DEDUP_WINDOW_SECONDS || '900', 10);

    const windowStartMs = capturedAt.getTime() - windowSeconds * 1000;

    // Search existing images for this camera in the time window
    const recentImages = Array.from(this.db.mockImages.values()).filter((img) => {
      return (
        img.deviceId === deviceId &&
        img.retentionStatus === 'ACTIVE' &&
        new Date(img.capturedAt).getTime() >= windowStartMs
      );
    });

    for (const prev of recentImages) {
      // 1. Exact SHA-256 Byte Match
      if (exactEnabled && prev.sha256 === sha256) {
        return {
          isDuplicate: true,
          reason: 'DUPLICATE_EXACT',
          matchedImageId: prev.id,
          sha256,
          perceptualHash: pHash,
          hammingDistance: 0,
        };
      }

      // 2. Perceptual Similarity Match
      if (perceptualEnabled && prev.perceptualHash) {
        const dist = this.hammingDistance(prev.perceptualHash, pHash);
        if (dist <= threshold) {
          return {
            isDuplicate: true,
            reason: 'DUPLICATE_NEAR',
            matchedImageId: prev.id,
            sha256,
            perceptualHash: pHash,
            hammingDistance: dist,
          };
        }
      }
    }

    return {
      isDuplicate: false,
      sha256,
      perceptualHash: pHash,
    };
  }
}

