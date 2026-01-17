module.exports = {
    apps: [
        {
            name: 'anufy-api',
            script: 'dist/index.js',
            instances: 'max', // Use all CPU cores
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 8000
            },
            watch: false,
            max_memory_restart: '800M',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm Z',
            merge_logs: true,
            autorestart: true
        },
        {
            name: 'anufy-worker',
            script: 'dist/worker-entry.js',
            instances: 1, // Only one worker process needed for now
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/worker-err.log',
            out_file: './logs/worker-out.log',
            merge_logs: true,
            autorestart: true
        }
    ]
};
