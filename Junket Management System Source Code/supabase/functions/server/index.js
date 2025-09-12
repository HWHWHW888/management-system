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
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
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
  app.listen(PORT, () => {
    console.log(`🚀 Junket Management API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
