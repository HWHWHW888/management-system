import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import route modules
import authRouter from './auth.js';
import usersRouter from './users.js';
import agentsRouter from './agents.js';
import customersRouter from './customers.js';
import staffsRouter from './staffs.js';
import tripsRouter from './trips.js';
import transactionsRouter from './transactions.js';
import reportsRouter from './reports.js';
import rollingRecordsRouter from './rolling-records.js';
import buyInOutRecordsRouter from './buy-in-out-records.js';
import chipExchangesRouter from './chip-exchanges.js';
// import gameTypesRouter from './game-types.js'; // Commented out - file doesn't exist


const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'https://management-system-frontend.netlify.app',
      'https://management-system-production-2a78.up.railway.app',
      'https://hoewingroup.com'
    ];
    
    // Check if origin is in allowed list or is any Netlify/Cloudflare Pages subdomain
    if (allowedOrigins.includes(origin) || 
        origin.endsWith('.netlify.app') ||
        origin.endsWith('.pages.dev')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Junket Management API'
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/staffs', staffsRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/rolling-records', rollingRecordsRouter);
app.use('/api/buy-in-out-records', buyInOutRecordsRouter);
app.use('/api/chip-exchanges', chipExchangesRouter);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Junket Management API running on ${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
