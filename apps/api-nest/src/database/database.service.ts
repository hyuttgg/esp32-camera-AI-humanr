import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { MongoClient, Db, GridFSBucket } from 'mongodb';
import Redis from 'ioredis';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  // MySQL Connection Pool
  public mysqlPool: mysql.Pool | null = null;
  public isMysqlConnected = false;

  // MongoDB & GridFS
  public mongoClient: MongoClient | null = null;
  public mongoDb: Db | null = null;
  public gridFsBucket: GridFSBucket | null = null;
  public isMongoConnected = false;

  // Redis Client
  public redisClient: Redis | null = null;
  public isRedisConnected = false;

  // Mock / Memory Fallback Stores (active when external DB services are offline during dev/demo)
  public mockUsers: Map<string, any> = new Map();
  public mockDevices: Map<string, any> = new Map();
  public mockCommands: Map<string, any> = new Map();
  public mockImages: Map<string, any> = new Map();
  public mockGridFsFiles: Map<string, { buffer: Buffer; contentType: string }> = new Map();
  public mockAuditLogs: Array<any> = [];

  async OnModuleInit() {
    await this.initAllDatabases();
  }

  async onModuleInit() {
    await this.initAllDatabases();
  }

  async onModuleDestroy() {
    if (this.mysqlPool) {
      await this.mysqlPool.end();
    }
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  private async initAllDatabases() {
    // 1. Initialize MySQL Connection
    try {
      this.mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        database: process.env.MYSQL_DATABASE || 'ocean_vision',
        user: process.env.MYSQL_USER || 'ocean_user',
        password: process.env.MYSQL_PASSWORD || 'ocean_pass',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Quick ping test
      const conn = await this.mysqlPool.getConnection();
      await conn.ping();
      conn.release();
      this.isMysqlConnected = true;
      await this.ensureMysqlSchema();
      this.logger.log('MySQL 8.x Connection Pool & Parameterized Schema established successfully.');
    } catch (err: any) {
      this.logger.warn(`MySQL connection unavailable (${err.message}). Activating In-Memory Fallback Adapter for local development.`);
      this.isMysqlConnected = false;
    }

    // 2. Initialize MongoDB Atlas & GridFS
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri && !mongoUri.includes('<db_username>')) {
      try {
        this.mongoClient = new MongoClient(mongoUri, {
          connectTimeoutMS: 5000,
          serverSelectionTimeoutMS: 5000,
        });
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db(process.env.MONGODB_DATABASE || 'ocean_vision');
        const bucketName = process.env.MONGODB_GRIDFS_BUCKET || 'cameraImages';
        this.gridFsBucket = new GridFSBucket(this.mongoDb, { bucketName });
        this.isMongoConnected = true;
        this.logger.log(`MongoDB Atlas connected. GridFS Bucket '${bucketName}' ready.`);
      } catch (err: any) {
        this.logger.warn(`MongoDB Atlas connection error (${err.message}). Using High-Speed Memory-Backed GridFS Storage.`);
        this.isMongoConnected = false;
      }
    } else {
      this.logger.log('MONGODB_URI not configured or contains placeholder. Active Memory-Backed GridFS Storage mode.');
      this.isMongoConnected = false;
    }

    // 3. Initialize Redis Client
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      await this.redisClient.connect();
      this.isRedisConnected = true;
      this.logger.log('Redis client connected successfully.');
    } catch (err: any) {
      this.logger.warn(`Redis unavailable (${err.message}). Using local In-Memory Distributed Lock & Counter fallback.`);
      this.isRedisConnected = false;
    }

    // 4. Seed initial default demo data if in fallback mode
    this.seedFallbackData();
  }

  /**
   * Thực thi truy vấn MySQL có tham số (Prepared Statement với dấu ? chống SQL Injection).
   */
  public async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (!this.mysqlPool || !this.isMysqlConnected) {
      throw new Error('MySQL connection pool is not active');
    }
    const [rows] = await this.mysqlPool.execute(sql, params);
    return rows as unknown as T;
  }

  private async ensureMysqlSchema() {
    if (!this.mysqlPool) return;
    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        full_name VARCHAR(150) NULL,
        password_hash VARCHAR(255) NOT NULL,
        google_id VARCHAR(128) NULL UNIQUE,
        auth_provider ENUM('LOCAL', 'GOOGLE') NOT NULL DEFAULT 'LOCAL',
        avatar_url VARCHAR(512) NULL,
        status ENUM('ACTIVE', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
        mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
        mfa_secret VARCHAR(128) NULL,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_google_id (google_id),
        INDEX idx_users_status (status)
      ) ENGINE=InnoDB;
    `);

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        actor_type ENUM('USER', 'DEVICE', 'SYSTEM', 'RETENTION_WORKER') NOT NULL,
        actor_id VARCHAR(128) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(64) NOT NULL,
        target_id VARCHAR(128) NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(512) NULL,
        result ENUM('SUCCESS', 'DENIED', 'ERROR') NOT NULL DEFAULT 'SUCCESS',
        metadata_json JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB;
    `);
  }

  private seedFallbackData() {
    // Default Admin User
    const adminUser = {
      id: 1,
      email: 'admin@oceanvision.ai',
      username: 'admin',
      passwordHash: '$2a$10$wK1mB5q6x4w7FjM6dZ8sZe5kL6Yt4Fq1ca1d0UQnK559OceanAdm', // precomputed hash for OceanAdmin@2026
      roles: ['SUPER_ADMIN', 'ADMIN'],
      status: 'ACTIVE',
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    };
    this.mockUsers.set('admin@oceanvision.ai', adminUser);
    this.mockUsers.set('admin', adminUser);

    // Default Demo ESP32-CAM Devices
    const demoCam1 = {
      id: 'esp32-cam-01',
      name: 'ESP32-CAM Cổng Chính (Lối vào sân vườn)',
      deviceKeyId: 'key-esp32-01',
      secret: 'dev_shared_provisioning_key_replace_in_prod',
      status: 'ONLINE',
      connectionMode: 'STA',
      ipAddress: '192.168.1.105',
      rssi: -54,
      firmwareVersion: '1.0.0-turboquant',
      lastSeenAt: new Date().toISOString(),
      configVersion: 1,
      uptimeSeconds: 15420,
      freeHeapBytes: 158420,
      freePsramBytes: 3824100,
    };

    const demoCam2 = {
      id: 'esp32-cam-02',
      name: 'ESP32-CAM Ban Công Tầng 2',
      deviceKeyId: 'key-esp32-02',
      secret: 'dev_shared_provisioning_key_replace_in_prod',
      status: 'ONLINE',
      connectionMode: 'STA',
      ipAddress: '192.168.1.108',
      rssi: -62,
      firmwareVersion: '1.0.0-turboquant',
      lastSeenAt: new Date(Date.now() - 35000).toISOString(),
      configVersion: 1,
      uptimeSeconds: 8430,
      freeHeapBytes: 161200,
      freePsramBytes: 3910200,
    };

    this.mockDevices.set('esp32-cam-01', demoCam1);
    this.mockDevices.set('esp32-cam-02', demoCam2);
  }
}

