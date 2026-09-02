/**
 * PM2 ecosystem file for the eFootball Account Reseller.
 *
 * Usage on the VPS:
 *   npm install
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup    # follow the printed command to enable boot autostart
 *
 * The process is named "efootball-reseller" and will:
 *   - log to ./logs/out.log and ./logs/err.log (auto-created by PM2)
 *   - auto-restart on crash
 *   - cap memory at 300 MB and reload gracefully
 */
module.exports = {
    apps: [
        {
            name: 'efootball-reseller',
            script: 'server.js',
            cwd: __dirname,
            // Production defaults — no watch, no cluster (single instance is fine
            // for this workload; bump to "max" if traffic grows).
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            // Memory cap: restart the worker if it grows past 300 MB.
            max_memory_restart: '300M',
            // Crash backoff: wait up to 5 s before restarting a crashed process.
            restart_delay: 2000,
            max_restarts: 10,
            min_uptime: '10s',
            // Logging
            out_file: './logs/out.log',
            error_file: './logs/err.log',
            merge_logs: true,
            time: true,
            // Environment — PORT can be overridden by the host (e.g. 3000, 8080, 80)
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
        },
    ],
};
