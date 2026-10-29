import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import * as fs from 'fs';

function formatBytes(bytes: number): string {
  if (bytes < 0) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

@Public()
@Controller('health')
export class HealthController {
  private readonly service = 'bookstore-api';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async healthCheck() {
    const health: Record<string, any> = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: this.service,
      version: '1.0.1',
      database: await this.checkDatabase(),
      memory: this.checkMemory(),
      disk: this.checkDisk(),
    };
    const allUp =
      health.database.status === 'UP' &&
      health.memory.status === 'UP' &&
      health.disk.status === 'UP';
    if (!allUp) health.status = 'DEGRADED';

    if (this.config.get<boolean>('isProduction')) {
      delete health.version;
      delete health.database;
      delete health.memory;
      delete health.disk;
    }
    return health;
  }

  @Get('live')
  liveness() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: this.service,
    };
  }

  @Get('ready')
  async readiness(@Res() res: any) {
    const ready: Record<string, any> = {
      timestamp: new Date().toISOString(),
      service: this.service,
    };
    try {
      await this.dataSource.query('SELECT 1');
      ready.status = 'UP';
      ready.database = 'UP';
      return res.status(HttpStatus.OK).json(ready);
    } catch {
      ready.status = 'DOWN';
      ready.database = 'DOWN';
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(ready);
    }
  }

  private async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'UP',
        database: this.config.get<string>('db.name'),
        driver: this.config.get<string>('db.type'),
      };
    } catch (e) {
      return { status: 'DOWN', error: (e as Error).message };
    }
  }

  private checkMemory() {
    const usage = process.memoryUsage();
    const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;
    const check: Record<string, any> = {
      'heap.used': formatBytes(usage.heapUsed),
      'heap.max': formatBytes(usage.heapTotal),
      'heap.percent': `${heapPercent.toFixed(1)}%`,
      'nonHeap.used': formatBytes(usage.rss - usage.heapTotal),
      'nonHeap.max': 'unknown',
    };
    if (heapPercent > 95) {
      check.status = 'CRITICAL';
      check.alert = 'Heap memory usage above 95%!';
    } else if (heapPercent > 85) {
      check.status = 'WARNING';
      check.alert = 'Heap memory usage above 85%';
    } else {
      check.status = 'UP';
    }
    return check;
  }

  private checkDisk() {
    try {
      const stats = fs.statfsSync(process.cwd());
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const usedPercent = total > 0 ? (used / total) * 100 : 0;
      const check: Record<string, any> = {
        'root.total': formatBytes(total),
        'root.free': formatBytes(free),
        'root.used': formatBytes(used),
        'root.percent': `${usedPercent.toFixed(1)}%`,
      };
      if (usedPercent > 90) {
        check.status = 'CRITICAL';
        check.alert = 'Disk usage above 90%!';
      } else if (usedPercent > 80) {
        check.status = 'WARNING';
        check.alert = 'Disk usage above 80%';
      } else {
        check.status = 'UP';
      }
      return check;
    } catch (e) {
      return { status: 'UNKNOWN', error: (e as Error).message };
    }
  }
}
