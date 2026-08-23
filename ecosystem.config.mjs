export default {
  apps: [
    {
      name: 'forsil99-backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 7038,
      },
    },
  ],
};
