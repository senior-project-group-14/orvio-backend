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
const app = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Host: ${HOST}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

