import { MongoClient } from 'mongodb';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  // Fallback to a hardcoded check if environment variables aren't injected yet
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DATABASE_NAME;
  if (!uri) throw new Error("MONGODB_URI environment variable is missing!");
  if (!dbName) throw new Error("DATABASE_NAME environment variable is missing!");
  
  const client = await MongoClient.connect(uri);
  cachedDb = client.db(dbName); // Uses the default database defined in your connection string
  return cachedDb;
}

export default async function handler(request, response) {
  // 1. Force Allow ALL Origins for CORS to fix frontend communication blocks
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handle Browser CORS Preflight Request (Crucial step)
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await connectToDatabase();
    const payload = request.body || {};

    const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

    const logEntry = {
      timestamp: new Date(),
      ip: clientIp ? clientIp.split(',')[0].trim() : 'Unknown',
      screen_resolution: payload.screen_resolution || 'Unknown',
      language: payload.language || 'Unknown',
      local_timezone: payload.local_timezone || 'Unknown',
      path: payload.path || '',
      userAgent: payload.userAgent || ''
    };

    await db.collection('visits').insertOne(logEntry);

    return response.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Database logging failed:', error);
    return response.status(500).json({ error: 'Internal server error', details: error.message });
  }
}