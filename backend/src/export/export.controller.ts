import { Body, Controller, Post, Res } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportGlobalDto } from './dto/export-global.dto';
import { Response } from 'express';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) { }

  @Post('global')
  async exportGlobal(@Body() dto: ExportGlobalDto, @Res() res: Response) {
    return this.exportService.exportGlobal(dto, res);
  }
}
