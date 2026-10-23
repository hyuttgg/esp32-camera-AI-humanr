import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GridFsStorageService } from '../ingestion/storage.service';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private db: DatabaseService,
    private storage: GridFsStorageService,
  ) {}

  getImages(page = 1, limit = 20, deviceId?: string, hasHuman?: boolean) {
    let all = Array.from(this.db.mockImages.values()).filter(
      (img) => img.retentionStatus !== 'DELETED',
    );

    if (deviceId) {
      all = all.filter((img) => img.deviceId === deviceId);
    }

    if (hasHuman !== undefined) {
      all = all.filter((img) => img.detectionSummary?.hasHuman === hasHuman);
    }

    // Sort descending by capturedAt
    all.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = all.slice(startIndex, startIndex + limit);

    return {
      page,
      limit,
      total,
      totalPages,
      data,
    };
  }

  getImageMetadata(id: string) {
    const img = this.db.mockImages.get(id);
    if (!img || img.retentionStatus === 'DELETED') {
      throw new NotFoundException(`Image ${id} not found or has been purged by retention policy`);
    }
    return img;
  }

  async getImageStream(id: string) {
    const img = this.getImageMetadata(id);
    return this.storage.getImageStream(img.gridFsFileId || id);
  }

  async deleteImage(id: string, actor: string) {
    const img = this.getImageMetadata(id);

    // 1. Purge from GridFS Bucket
    await this.storage.purgeImage(img.gridFsFileId || id);

    // 2. Mark retentionStatus = DELETED in database
    img.retentionStatus = 'DELETED';
    img.deletedAt = new Date().toISOString();
    img.deletedBy = actor;
    this.db.mockImages.set(id, img);

    // 3. Audit log
    this.db.mockAuditLogs.unshift({
      id: Date.now(),
      actorType: 'USER',
      actorId: actor,
      action: 'MANUAL_PURGE',
      targetType: 'IMAGE',
      targetId: id,
      result: 'SUCCESS',
      metadataSafe: { deviceId: img.deviceId, capturedAt: img.capturedAt },
      timestamp: new Date().toISOString(),
    });

    return {
      deleted: true,
      imageId: id,
      purgedFromGridFS: true,
      auditLogged: true,
    };
  }
}

