import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { GridFsStorageService } from '../ingestion/storage.service';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private isPurgeRunning = false;

  private currentPolicy = {
    mode: process.env.RETENTION_MODE || 'AFTER_CAPTURE',
    retentionHours: parseInt(process.env.RETENTION_HOURS || '15', 10),
    dailyCutoffTime: process.env.DAILY_CUTOFF_TIME || '15:00',
    timezone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
    dedupExactEnabled: process.env.DEDUP_EXACT_ENABLED !== 'false',
    dedupPerceptualEnabled: process.env.DEDUP_PERCEPTUAL_ENABLED !== 'false',
    dedupPhashThreshold: parseInt(process.env.DEDUP_PHASH_HAMMING_THRESHOLD || '8', 10),
    dedupWindowSeconds: parseInt(process.env.DEDUP_WINDOW_SECONDS || '900', 10),
  };

  constructor(
    private db: DatabaseService,
    private storage: GridFsStorageService,
  ) {}

  getPolicy() {
    return this.currentPolicy;
  }

  updatePolicy(newPolicy: Partial<typeof this.currentPolicy>) {
    this.currentPolicy = {
      ...this.currentPolicy,
      ...newPolicy,
    };
    this.logger.log(`Retention policy updated: Mode=${this.currentPolicy.mode}, Hours=${this.currentPolicy.retentionHours}`);
    return this.currentPolicy;
  }

  /**
   * Periodic Retention Purge Engine.
   * Runs every 60 seconds to scan for expired images and atomically purge GridFS binary + chunks.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async executeRetentionPurge(): Promise<{ purgedCount: number; errors: number }> {
    if (this.isPurgeRunning) {
      return { purgedCount: 0, errors: 0 };
    }

    this.isPurgeRunning = true;
    let purgedCount = 0;
    let errors = 0;

    try {
      const now = new Date();

      // Scan MongoDB / Memory store for expired images
      const expiredImages = Array.from(this.db.mockImages.values()).filter(
        (img) => img.retentionStatus === 'ACTIVE' && new Date(img.expiresAt).getTime() <= now.getTime(),
      );

      if (expiredImages.length > 0) {
        this.logger.log(`Retention Purge triggered: Found ${expiredImages.length} expired images.`);
      }

      for (const img of expiredImages) {
        try {
          // 1. Mark EXPIRING atomically
          img.retentionStatus = 'EXPIRING';

          // 2. Delete file and chunks from GridFS
          await this.storage.purgeImage(img.gridFsFileId || img.id);

          // 3. Mark DELETED and clear reference
          img.retentionStatus = 'DELETED';
          img.purgedAt = now.toISOString();
          this.db.mockImages.set(img.id, img);

          // 4. Record Non-Confidential Audit Event
          this.db.mockAuditLogs.unshift({
            id: Date.now(),
            actorType: 'SYSTEM_CRON',
            actorId: 'RETENTION_WORKER',
            action: 'RETENTION_PURGE',
            targetType: 'IMAGE',
            targetId: img.id,
            result: 'SUCCESS',
            metadataSafe: {
              deviceId: img.deviceId,
              capturedAt: img.capturedAt,
              policy: this.currentPolicy.mode,
            },
            timestamp: now.toISOString(),
          });

          purgedCount++;
        } catch (err: any) {
          this.logger.error(`Error purging expired image ${img.id}: ${err.message}`);
          img.retentionStatus = 'FAILED_PURGE';
          errors++;
        }
      }
    } finally {
      this.isPurgeRunning = false;
    }

    return { purgedCount, errors };
  }

  getRetentionStats() {
    const images = Array.from(this.db.mockImages.values());
    const active = images.filter((i) => i.retentionStatus === 'ACTIVE').length;
    const deleted = images.filter((i) => i.retentionStatus === 'DELETED').length;

    return {
      policy: this.currentPolicy,
      totalTracked: images.length,
      activeImages: active,
      purgedImages: deleted,
      serverTimeUtc: new Date().toISOString(),
    };
  }
}

