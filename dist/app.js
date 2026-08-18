import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import { config } from './config/index.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { initFirebaseAdmin } from './services/firebase/firebaseAdmin.js';
// Initialize Firebase Admin
initFirebaseAdmin();
export const app = express();
// Security HTTP headers
app.use(helmet());
// CORS configuration (allow mobile apps, localhost and LAN IPs)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));
// Request body parsers (supports large high-res base64 photos)
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));
// Request logging in development
if (config.env === 'development') {
    app.use(morgan('dev'));
}
// Apply rate limiter to API endpoints
app.use('/api', generalLimiter);
// Mount main API router under /api/v1
app.use('/api/v1', apiRouter);
// Health check endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        app: config.appName,
        service: 'Forsil 99 API',
        timestamp: new Date().toISOString(),
    });
});
// Root info endpoint
app.get('/', (req, res) => {
    res.json({
        name: config.appName,
        version: '1.0.0',
        description: 'Forsil 99 (SMAN 59 Jakarta 1999) REST API Backend',
        status: 'running',
        apiDocs: '/api/v1/health',
    });
});
// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan pada server API.`,
    });
});
// Global error handler
app.use(errorHandler);
