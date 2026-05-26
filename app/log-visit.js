import { MongoClient } from 'mongodb';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DATABASE_NAME;
  
  if (!uri) throw new Error("MONGODB_URI environment variable is missing!");
  if (!dbName) throw new Error("DATABASE_NAME environment variable is missing!");
  
  const client = await MongoClient.connect(uri);
  cachedDb = client.db(dbName);
  return cachedDb;
}

export default async function handler(request, response) {
  // 1. Allow ALL Origins for CORS to fix frontend communication blocks
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handle Browser CORS Preflight Request
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

    // 3. Extract Geolocation Data from Vercel Edge Headers
    const country = request.headers['x-vercel-ip-country'] || 'Unknown';
    const region = request.headers['x-vercel-ip-country-region'] || 'Unknown';
    const city = request.headers['x-vercel-ip-city'] || 'Unknown';
    const latitude = request.headers['x-vercel-ip-latitude'];
    const longitude = request.headers['x-vercel-ip-longitude'];

    // 4. Formulate the Google Maps URL if coordinates exist
    let googleMapsUrl = 'Unknown';
    if (latitude && longitude) {
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const logEntry = {
      timestamp: new Date(),
      ip: clientIp ? clientIp.split(',')[0].trim() : 'Unknown',
      country: decodeURIComponent(country),
      region: decodeURIComponent(region),
      city: decodeURIComponent(city),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      location_maps_url: googleMapsUrl, // Your new clickable maps string
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