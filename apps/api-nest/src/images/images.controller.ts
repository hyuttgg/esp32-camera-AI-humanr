import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  Request,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { ImagesService } from './images.service';

@Controller(['images', 'v1/images'])
export class ImagesController {
  constructor(private imagesService: ImagesService) {}

  @Get()
  getImages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('deviceId') deviceId?: string,
    @Query('hasHuman') hasHuman?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '50', 10);
    const humanBool = hasHuman !== undefined ? hasHuman === 'true' : undefined;
    return this.imagesService.getImages(pageNum, limitNum, deviceId, humanBool);
  }

  @Get(':id/metadata')
  getMetadata(@Param('id') id: string) {
    return this.imagesService.getImageMetadata(id);
  }

  /**
   * Stream binary JPEG from GridFS.
   * Strictly enforces: Cache-Control: no-store, no-cache, must-revalidate, private
   */
  @Get([':id/content', ':id/stream'])
  async getContent(@Param('id') id: string, @Res() res: Response) {
    const { stream, length, contentType } = await this.imagesService.getImageStream(id);

    res.set({
      'Content-Type': contentType || 'image/jpeg',
      'Content-Length': length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    });

    stream.pipe(res);
  }

  @Post(':id/delete')
  @HttpCode(200)
  deleteImage(@Param('id') id: string, @Request() req: any) {
    const actor = req.user ? req.user.email : 'admin';
    return this.imagesService.deleteImage(id, actor);
  }

  @Delete(':id')
  deleteImageRest(@Param('id') id: string, @Request() req: any) {
    const actor = req.user ? req.user.email : 'admin';
    return this.imagesService.deleteImage(id, actor);
  }
}

