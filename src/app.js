/*require("dotenv").config();

const http = require("http");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

const requestHandler = async (req, res) => {
  const result = await sql`SELECT version()`;
  const { version } = result[0];
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(version);
};

http.createServer(requestHandler).listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});*/

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
//const errorHandler = require('./middleware/errorHandler');

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Import routes
const authRoutes = require('./routes/authRoutes');
const sysadminRoutes = require('./routes/sysadminRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const coolerRoutes = require('./routes/coolerRoutes');
const brandRoutes = require('./routes/brandRoutes');
const productRoutes = require('./routes/productRoutes');
const alertRoutes = require('./routes/alertRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const qrRoutes = require('./routes/qr');

const app = express();

// Middleware
app.use(
  cors({
    origin: '*', // Tüm cihazlardan erişime açılıyor (geliştirme için)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token', 'Accept'],
    credentials: false, // origin '*' ise false olmalı
  })
);
// Handle preflight requests
//app.options('*', cors());
app.use(morgan('dev'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend build in production with explicit cache policy.
if (process.env.NODE_ENV === 'production') {
  const fallbackBuildPath = path.resolve(__dirname, '../../orvio-frontend/frontend/build');
  const frontendBuildPath = process.env.FRONTEND_BUILD_PATH || fallbackBuildPath;
  const frontendExists = fs.existsSync(frontendBuildPath);

  if (frontendExists) {
    app.use(
      '/orvio-ui/assets',
      express.static(path.join(frontendBuildPath, 'assets'), {
        immutable: true,
        maxAge: '365d',
      })
    );

    app.use(
      '/orvio-ui',
      express.static(frontendBuildPath, {
        maxAge: 0,
        setHeaders: (res, servedFilePath) => {
          if (servedFilePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );

    app.get('/orvio-ui/*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  }
}

// Swagger UI route
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Orvio Backend API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  })
);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Orvio Backend API', version: '1.0.0' });
});

// Routes
app.use('/auth', authRoutes); 
app.use('/', sysadminRoutes);
app.use('/', telemetryRoutes);
app.use('/admin', adminRoutes);
app.use('/', transactionRoutes);
app.use('/', sessionRoutes);
app.use('/devices', deviceRoutes);
app.use('/coolers', coolerRoutes);
app.use('/brands', brandRoutes);
app.use('/products', productRoutes);
app.use('/alerts', alertRoutes);
app.use('/disputes', disputeRoutes);
app.use('/qr', qrRoutes);

// Error handler (must be last)
//app.use(errorHandler);

module.exports = app;
