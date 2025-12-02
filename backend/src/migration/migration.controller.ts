// src/migration/migration.controller.ts
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MigrationService } from './migration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Migration')
@ApiBearerAuth()
@Controller('migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('users')
  @ApiOperation({ summary: 'Migrate users from MySQL to PostgreSQL' })
  @ApiResponse({ 
    status: 201, 
    description: 'Users migration completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        migrated: { type: 'number' },
        errors: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'number' },
              email: { type: 'string' },
              error: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async migrateUsers() {
    const result = await this.migrationService.migrateUsers();
    return {
      success: true,
      ...result
    };
  }

  @Post('all')
  @ApiOperation({ summary: 'Migrate all data from MySQL to PostgreSQL' })
  @ApiResponse({ 
    status: 201, 
    description: 'Data migration completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        users: {
          type: 'object',
          properties: {
            migrated: { type: 'number' },
            errors: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'number' },
                  email: { type: 'string' },
                  error: { type: 'string' }
                }
              }
            }
          }
        }
        // Add other entities here when you implement their migrations
      }
    }
  })
  async migrateAll() {
    // Start with users migration
    const usersResult = await this.migrationService.migrateUsers();
    
    // Add other migrations here when implemented
    // const otherResults = await this.migrationService.migrateOtherEntities();
    
    return {
      success: true,
      users: usersResult,
      // other: otherResults
    };
  }
}