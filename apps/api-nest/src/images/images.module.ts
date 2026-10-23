import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { GridFsStorageService } from '../ingestion/storage.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, GridFsStorageService, DatabaseService],
  exports: [ImagesService],
})
export class ImagesModule {}

