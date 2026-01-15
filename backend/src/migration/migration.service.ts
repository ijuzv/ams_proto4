import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as mysql from 'mysql2/promise';

export interface UserData {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN' | 'MANAGER';
  managerId: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MigrationService {
  private mysqlPool: mysql.Pool;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize MySQL connection pool
    this.mysqlPool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'HelloWorld123',
      database: 'attendance_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async migrateUsers(): Promise<{ migrated: number; errors: any[] }> {
    let connection;
    const errors: any[] = [];
    let migrated = 0;

    try {
      // Get MySQL connection
      connection = await this.mysqlPool.getConnection();
      
      // Fetch users from MySQL
      const [users] = await connection.query('SELECT * FROM user');
      const mysqlUsers = users as UserData[];

      // Process each user
      for (const user of mysqlUsers) {
        try {
          // Check if user already exists in PostgreSQL
          const existingUser = await this.prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // Create new user in PostgreSQL using Prisma
            await this.prisma.user.create({
              data: {
                name: user.name,
                email: user.email,
                password: user.password, // Note: Make sure passwords are hashed if needed
                role: user.role,
                managerId: user.managerId,
                active: user.active,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              },
            });
            migrated++;
          }
        } catch (error) {
          errors.push({
            userId: user.id,
            email: user.email,
            error: error.message,
          });
        }
      }

      return { migrated, errors };
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    } finally {
      if (connection) {
        await connection.release();
      }
    }
  }
}
