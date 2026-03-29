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

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initializeSocketIO } = require('./config/socketIO');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocketIO(server);

// Make io instance globally available
global.io = io;

server.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Host: ${HOST}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Socket.io initialized and ready for connections`);
});

