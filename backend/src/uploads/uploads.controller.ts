import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) =>
        callback(null, file.mimetype.startsWith('image/')),
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    return this.upload(file, 'one-school/events');
  }

  @Post('article-image')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) =>
        callback(null, file.mimetype.startsWith('image/')),
    }),
  )
  async uploadArticleImage(@UploadedFile() file?: Express.Multer.File) {
    return this.upload(file, 'one-school/articles');
  }

  @Post('connect-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) =>
        callback(null, file.mimetype.startsWith('image/')),
    }),
  )
  async uploadConnectImage(@UploadedFile() file?: Express.Multer.File) {
    return this.upload(file, 'one-school/connect');
  }

  private async upload(file: Express.Multer.File | undefined, folder: string) {
    if (!file) throw new BadRequestException('Cần chọn một tệp hình ảnh');
    this.configure();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
          transformation: [
            { quality: 'auto', fetch_format: 'auto', width: 1400, height: 1400, crop: 'limit' },
          ],
        },
        (error, uploaded) => {
          if (error || !uploaded)
            reject(
              new Error(
                error?.message ?? 'Cloudinary không trả về kết quả upload',
              ),
            );
          else resolve(uploaded);
        },
      );
      stream.end(file.buffer);
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  private configure() {
    if (this.configured) return;
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret)
      throw new BadRequestException('Chức năng tải ảnh chưa được cấu hình');
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.configured = true;
  }
}
