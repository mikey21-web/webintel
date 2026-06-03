module.exports = {
  apps: [
    { name: 'webintel-api', script: 'dist/index.js', cwd: '/home/uday/webintel', instances: 1, autorestart: true, watch: false, max_memory_restart: '512M', env: { NODE_ENV: 'production', PORT: 3456 } },
    { name: 'webintel-py', script: 'start.sh', interpreter: 'bash', cwd: '/home/uday/webintel/python', autorestart: true, watch: false, max_memory_restart: '1G' },
    { name: 'webintel-worker-crawl', script: 'dist/queue/workers/crawlWorker.js', cwd: '/home/uday/webintel', instances: 1, autorestart: true },
    { name: 'webintel-worker-intel', script: 'dist/queue/workers/intelWorker.js', cwd: '/home/uday/webintel', instances: 1, autorestart: true },
    { name: 'webintel-worker-monitor', script: 'dist/queue/workers/monitorWorker.js', cwd: '/home/uday/webintel', instances: 1, autorestart: true },
    { name: 'webintel-dashboard', script: 'node_modules/.bin/next', args: 'start -p 3457', cwd: '/home/uday/webintel/dashboard', autorestart: true },
  ],
};
