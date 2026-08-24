import http from 'http';
import { app } from './app.js';
import { config } from './config/index.js';
import { prisma } from './lib/prisma.js';
// Optimize global HTTP agent for high-throughput concurrency
http.globalAgent.maxSockets = Infinity;
const PORT = config.port;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 ${config.appName} RUNNING ON PORT ${PORT}`);
    console.log(`📡 Local URL:   http://localhost:${PORT}/api/v1`);
    console.log(`🌱 Environment: ${config.env}`);
    console.log(`🐘 Database:    PostgreSQL (Prisma ORM - High Concurrency 1000+ Ready)`);
    console.log(`=======================================================`);
});
// Configure server connection timeouts and pool limits for 1,000+ concurrent clients
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxConnections = 3000;
// Handle graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
        console.log('HTTP server closed.');
        await prisma.$disconnect();
        console.log('Database connection closed.');
        process.exit(0);
    });
    // Force close if graceful shutdown takes too long
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception thrown:', error);
});
