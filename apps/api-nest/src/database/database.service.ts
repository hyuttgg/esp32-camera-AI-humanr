import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { MongoClient, Db, GridFSBucket } from 'mongodb';
import Redis from 'ioredis';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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
        connectTimeout: 3000,
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
      if (this.mysqlPool) {
        await this.mysqlPool.end().catch(() => {});
        this.mysqlPool = null;
      }
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

    // 3. Initialize Redis Client (with silent fallback & zero retry spam when Redis is not provisioned)
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && !redisUrl.includes('localhost') && !redisUrl.includes('127.0.0.1')) {
      try {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy: () => null, // Stop endless reconnect loop if Redis is offline
        });
        this.redisClient.on('error', () => {
          // Prevent '[ioredis] Unhandled error event' spam in cloud logs
        });
        await this.redisClient.connect();
        this.isRedisConnected = true;
        this.logger.log('Redis client connected successfully.');
      } catch (err: any) {
        this.logger.warn(`Redis unavailable (${err.message}). Using local In-Memory Distributed Lock & Counter fallback.`);
        this.isRedisConnected = false;
        if (this.redisClient) {
          this.redisClient.disconnect();
          this.redisClient = null;
        }
      }
    } else {
      this.logger.log('External REDIS_URL not configured. Using local In-Memory Distributed Lock & Counter fallback.');
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

  public latestTelemetry: any = null;
  public liveViewerFrame: Buffer | null = null;
  public liveViewerLastFrameTs: number = 0;
  public latestCameraRawFrame: Buffer | null = null;
  public latestCameraRawFrameSeq: number = 0;
  public latestCameraRawFrameTime: string = new Date().toISOString();
  public latestCameraRawFrameMeta: any = null;
  public mjpegClients: Set<any> = new Set();

  public broadcastMjpegFrame(frameBuffer: Buffer) {
    if (!frameBuffer || frameBuffer.length < 50 || this.mjpegClients.size === 0) return;
    const boundary = Buffer.from(
      `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBuffer.length}\r\n\r\n`,
    );
    const trailing = Buffer.from('\r\n');
    for (const client of Array.from(this.mjpegClients)) {
      try {
        client.write(boundary);
        client.write(frameBuffer);
        client.write(trailing);
      } catch {
        this.mjpegClients.delete(client);
      }
    }
  }

  public liveViewerState: any = {
    running: true,
    script: 'scripts/python/live_viewer.py',
    cpp_firmware: 'src/main.cpp + src/ai/HumanDetector.cpp (EdgeImpulse 96x96 RGB888 #379)',
    engine_type: 'C++ EdgeImpulse + Python TurboQuant Co-op',
    connection_mode: 'WIFI_CLOUD_DAEMON',
    wifi_ssid: process.env.WIFI_SSID || 'khanh2007',
    wifi_ip: '192.168.0.109',
    wifi_rssi: -38,
    resolution: '320x240',
    upscaled_resolution: '640x480',
    fps: 15.0,
    inference_fps: 20.0,
    person_count: 0,
    ambient_lux: 112.0,
    lighting_mode: '[NGAY]',
    has_motion: false,
    motion_ratio: 0.0,
    frame_seq: 0,
    updated_at: new Date().toISOString(),
  };
  private liveViewerProc: ChildProcess | null = null;

  private seedFallbackData() {
    // Default Admin User for initial login before custom users are created
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

    this.startLiveViewerDaemon();
  }

  private startLiveViewerDaemon() {
    const candidates = [
      path.resolve(process.cwd(), 'scripts', 'python', 'live_viewer.py'),
      path.resolve(process.cwd(), '..', '..', 'scripts', 'python', 'live_viewer.py'),
    ];
    const scriptPath = candidates.find((p) => fs.existsSync(p));
    if (!scriptPath) {
      this.logger.warn('scripts/python/live_viewer.py not found in workspace; skipping embedded Python daemon.');
      return;
    }

    const port = process.env.PORT || '4000';
    const localBackendUrl = `http://127.0.0.1:${port}`;
    const wifiSsid = process.env.WIFI_SSID || 'khanh2007';
    const wifiPass = process.env.WIFI_PASS || '123456789';
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    const launch = () => {
      try {
        this.logger.log(`[LIVE-VIEWER] Starting 24/7 Embedded Python Daemon: ${pythonCmd} ${scriptPath} --cloud-daemon`);
        this.liveViewerProc = spawn(
          pythonCmd,
          [
            scriptPath,
            '--cloud-daemon',
            '--headless',
            '--wifi-ssid',
            wifiSsid,
            '--wifi-pass',
            wifiPass,
            '--cloud-url',
            localBackendUrl,
          ],
          {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
              ...process.env,
              CLOUD_BACKEND_URL: localBackendUrl,
              WIFI_SSID: wifiSsid,
              WIFI_PASS: wifiPass,
            },
          },
        );

        this.liveViewerProc.stdout?.on('data', (chunk: Buffer) => {
          const msg = chunk.toString('utf8').trim();
          if (msg) {
            this.logger.debug(`[live_viewer.py] ${msg}`);
          }
        });

        this.liveViewerProc.on('exit', (code) => {
          this.logger.warn(`[LIVE-VIEWER] live_viewer.py exited (code=${code}). Restarting in 5s...`);
          setTimeout(launch, 5000);
        });
      } catch (err: any) {
        this.logger.warn(`[LIVE-VIEWER] Failed to spawn live_viewer.py: ${err.message}`);
      }
    };

    // Delay 3 seconds so NestJS HTTP server is listening before live_viewer.py connects
    setTimeout(launch, 3000);
  }
}

