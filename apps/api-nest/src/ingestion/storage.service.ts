import { Injectable, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class GridFsStorageService {
  private readonly logger = new Logger(GridFsStorageService.name);

  constructor(private db: DatabaseService) {}

  /**
   * Stream binary JPEG buffer directly into MongoDB GridFS.
   * If MongoDB is offline, stores in memory fallback store.
   */
  async storeImage(
    buffer: Buffer,
    filename: string,
    metadata: Record<string, any>,
  ): Promise<string> {
    if (this.db.isMongoConnected && this.db.gridFsBucket) {
      return new Promise((resolve, reject) => {
        const readable = Readable.from(buffer);
        const uploadStream = this.db.gridFsBucket!.openUploadStream(filename, {
          contentType: 'image/jpeg',
          metadata,
        });

        readable.pipe(uploadStream)
          .on('error', (err) => {
            this.logger.error(`GridFS upload error: ${err.message}`);
            reject(err);
          })
          .on('finish', () => {
            resolve(uploadStream.id.toString());
          });
      });
    }

    // In-Memory Fallback
    const mockId = new ObjectId().toString();
    this.db.mockGridFsFiles.set(mockId, { buffer, contentType: 'image/jpeg' });
    return mockId;
  }

  /**
   * Retrieve binary stream from GridFS.
   */
  async getImageStream(fileId: string): Promise<{ stream: Readable; length: number; contentType: string }> {
    if (this.db.isMongoConnected && this.db.gridFsBucket) {
      try {
        const objId = new ObjectId(fileId);
        const files = await this.db.mongoDb!.collection('cameraImages.files').find({ _id: objId }).toArray();
        if (files.length === 0) {
          throw new Error('File not found in GridFS');
        }
        const fileDoc = files[0];
        const stream = this.db.gridFsBucket.openDownloadStream(objId);
        return {
          stream,
          length: fileDoc.length,
          contentType: fileDoc.contentType || 'image/jpeg',
        };
      } catch (err: any) {
        this.logger.warn(`Failed reading GridFS file ${fileId}: ${err.message}. Checking fallback.`);
      }
    }

    // Fallback store lookup
    const fallbackFile = this.db.mockGridFsFiles.get(fileId);
    if (!fallbackFile) {
      throw new Error(`Image ID ${fileId} not found in storage`);
    }

    return {
      stream: Readable.from(fallbackFile.buffer),
      length: fallbackFile.buffer.length,
      contentType: fallbackFile.contentType,
    };
  }

  /**
   * Atomic Purge: Deletes file metadata record and all associated chunks from GridFS.
   */
  async purgeImage(fileId: string): Promise<boolean> {
    if (this.db.isMongoConnected && this.db.gridFsBucket) {
      try {
        const objId = new ObjectId(fileId);
        await this.db.gridFsBucket.delete(objId);
        return true;
      } catch (err: any) {
        this.logger.error(`Error deleting GridFS file ${fileId}: ${err.message}`);
      }
    }

    // Fallback delete
    return this.db.mockGridFsFiles.delete(fileId);
  }
}

