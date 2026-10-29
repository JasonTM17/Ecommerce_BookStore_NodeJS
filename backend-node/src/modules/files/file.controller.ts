import {
  Controller,
  Delete,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../entities/enums';
import { FileService } from './file.service';

/**
 * Uploads write to disk — restricted to ADMIN/MANAGER per the security model.
 * The GET side of /uploads/** is served as public static assets.
 */
@Controller('uploads')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('images')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return ApiResponse.success(await this.fileService.storeImage(file), 'Đã tải lên ảnh');
  }

  @Post('images/multiple')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
    return ApiResponse.success(await this.fileService.storeImages(files), 'Đã tải lên ảnh');
  }

  @Post('avatar')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return ApiResponse.success(await this.fileService.storeImage(file), 'Đã tải lên ảnh đại diện');
  }

  @Delete()
  @Roles(Role.ADMIN, Role.MANAGER)
  async deleteImage(@Query('url') url: string) {
    await this.fileService.deleteByUrl(url);
    return ApiResponse.success(null, 'Đã xóa ảnh');
  }
}
