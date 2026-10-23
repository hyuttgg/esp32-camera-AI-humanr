import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ImagesService } from './images.service';

@Controller('api/v1/images')
export class ImagesController {
  constructor(private imagesService: ImagesService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
  getImages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('deviceId') deviceId?: string,
    @Query('hasHuman') hasHuman?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    const humanBool = hasHuman !== undefined ? hasHuman === 'true' : undefined;
    return this.imagesService.getImages(pageNum, limitNum, deviceId, humanBool);
  }

  @Get(':id/metadata')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
  getMetadata(@Param('id') id: string) {
    return this.imagesService.getImageMetadata(id);
  }

  /**
   * Stream binary JPEG from GridFS.
   * Strictly enforces: Cache-Control: no-store, no-cache, must-revalidate, private
   * and requires authenticated JWT session.
   */
  @Get(':id/content')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('VIEWER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(200)
  deleteImage(@Param('id') id: string, @Request() req: any) {
    const actor = req.user ? req.user.email : 'admin';
    return this.imagesService.deleteImage(id, actor);
  }
}

