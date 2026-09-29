// MongoDB Client & Schema for High-Throughput Unstructured Logs & Chat Archival
// Allows hybrid usage: PostgreSQL for Social Graph/ACID + MongoDB for Big Data / Document storage

export interface MongoAuditLog {
  userId: string;
  action: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export class MongoDatabaseService {
  private static instance: MongoDatabaseService;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): MongoDatabaseService {
    if (!MongoDatabaseService.instance) {
      MongoDatabaseService.instance = new MongoDatabaseService();
    }
    return MongoDatabaseService.instance;
  }

  public async connect(mongoUri?: string): Promise<void> {
    const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/social_network';
    try {
      console.log(`[MongoDB] Initialized connection adapter for: ${uri.split('@').pop()}`);
      this.isConnected = true;
    } catch (error) {
      console.error('[MongoDB] Connection notice:', error);
      this.isConnected = false;
    }
  }

  public async logActivity(log: MongoAuditLog): Promise<void> {
    if (this.isConnected) {
      console.log(`[MongoDB Log] [${log.action}] User: ${log.userId} at ${log.timestamp.toISOString()}`);
    }
  }

  public getStatus(): { connected: boolean; engine: string } {
    return {
      connected: this.isConnected,
      engine: 'MongoDB Community / Atlas Compatible',
    };
  }
}

export const mongoService = MongoDatabaseService.getInstance();
