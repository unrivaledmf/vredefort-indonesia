module.exports = {
  apps: [
    {
      name: 'vredefort-app',
      script: 'npm',
      args: 'run start',
      cwd: '/var/www/mf035.my.id',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/vredefort-error.log',
      out_file: '/var/log/pm2/vredefort-out.log',
      merge_logs: true
    }
  ]
};
