/*require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Orvio Backend API' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});*/

const path = require('path');

// Load .env only in development (local fallback)
// In production, Azure App Service provides environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

const http = require('http');
const app = require('./app');
const { initializeSocketIO } = require('./config/socketIO');
const { startSessionHeartbeatMonitor } = require('./services/sessionHeartbeatMonitorService');
const { refreshProductCache } = require('./services/aiProductCacheService');

const AI_PRODUCT_CACHE_REFRESH_MS = 60 * 1000;

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Verify critical environment variables
const verifyEnvironmentVariables = () => {
  const requiredVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
  };

  console.log('\n========== ENVIRONMENT VARIABLES VERIFICATION ==========');
  console.log(`Environment: ${requiredVars.NODE_ENV || 'development'}`);
  console.log(`PORT: ${requiredVars.PORT}`);
  console.log(`DATABASE_URL loaded: ${requiredVars.DATABASE_URL ? '✓ YES' : '✗ NO'}`);
  
  if (requiredVars.DATABASE_URL) {
    // Mask the sensitive URL for logging
    const dbUrlMasked = requiredVars.DATABASE_URL.split('@')[0] + '@***MASKED***';
    console.log(`  Source: ${process.env.NODE_ENV === 'production' ? 'Azure App Service' : 'Local .env'}`);
    console.log(`  Database: ${dbUrlMasked}`);
  } else {
    console.error('✗ ERROR: DATABASE_URL is not set!');
    console.error('  In production: Configure in Azure App Service > Settings > Environment variables');
    console.error('  In development: Create .env file or set DATABASE_URL');
  }
  
  console.log(`JWT_SECRET loaded: ${requiredVars.JWT_SECRET ? '✓ YES' : '✗ NO'}`);
  console.log('=========================================================\n');

  if (!requiredVars.DATABASE_URL || !requiredVars.JWT_SECRET) {
    console.error('Missing critical environment variables. Exiting...');
    process.exit(1);
  }
};

verifyEnvironmentVariables();

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocketIO(server);

// Make io instance globally available
global.io = io;

startSessionHeartbeatMonitor();

server.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Host: ${HOST}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Socket.io initialized and ready for connections`);
});

refreshProductCache()
  .then((cachedCount) => {
    console.log(`AI product cache loaded: ${cachedCount} items`);
  })
  .catch((error) => {
    console.error('AI product cache preload failed:', error.message);
  });

setInterval(() => {
  refreshProductCache()
    .then((cachedCount) => {
      console.log(`AI product cache refreshed: ${cachedCount} items`);
    })
    .catch((error) => {
      console.error('AI product cache refresh failed:', error.message);
    });
}, AI_PRODUCT_CACHE_REFRESH_MS);

