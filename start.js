/**
 * Foodshare - Unified Single Command Project Runner
 * Starts ML Microservice (5001), Backend API (5000), and Frontend Server (3000) concurrently.
 */

const { spawn, execSync, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const ML_DIR = path.join(ROOT_DIR, 'ml');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 5000;
const ML_PORT = 5001;

// ANSI Colors for readable console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const childProcesses = [];

/**
 * Free up occupied ports on Windows and Unix before starting servers
 */
function freePort(port) {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = new Set();
      output.split('\n').forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && (parts[1].endsWith(`:${port}`) || parts[1].includes(`:${port}`))) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      });
      pids.forEach((pid) => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } catch (e) {}
      });
    } catch (e) {}
  } else {
    try {
      execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
    } catch (e) {}
  }
}

// Determine working python executable
function getPythonCommand() {
  const candidates = ['python', 'py', 'python3'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {}
  }
  return 'python';
}

const pythonCmd = getPythonCommand();

console.log(`\n${colors.bright}${colors.green}======================================================================${colors.reset}`);
console.log(`${colors.bright}${colors.green}   🌱 Foodshare – Food Donation & Intelligent Matching System   ${colors.reset}`);
console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}`);
console.log(` Checking and preparing ports (3000, 5000, 5001)...`);

// Ensure ports are completely free
[FRONTEND_PORT, BACKEND_PORT, ML_PORT].forEach(freePort);

console.log(` Starting all services with a single command...\n`);

/**
 * 1. Start Static Frontend HTTP Server
 */
function startFrontendServer() {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    let safeUrl = req.url.split('?')[0];
    if (safeUrl === '/' || safeUrl === '') {
      safeUrl = '/index.html';
    }

    const filePath = path.join(FRONTEND_DIR, safeUrl);

    // Prevent directory traversal
    if (!filePath.startsWith(FRONTEND_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        const ext = path.extname(safeUrl);
        if (!ext) {
          const htmlCandidate = `${filePath}.html`;
          if (fs.existsSync(htmlCandidate)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return fs.createReadStream(htmlCandidate).pipe(res);
          }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`File not found: ${safeUrl}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(FRONTEND_PORT, '0.0.0.0', () => {
    log('FRONTEND', `Running at http://localhost:${FRONTEND_PORT}`, colors.magenta);
  });

  server.on('error', (err) => {
    log('FRONTEND', `Server error: ${err.message}`, colors.red);
  });

  return server;
}

/**
 * 2. Start ML Microservice (FastAPI on Port 5001)
 */
function startMlService() {
  log('ML', `Starting FastAPI Microservice on port ${ML_PORT}...`, colors.cyan);

  const proc = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'app:app', '--port', String(ML_PORT), '--host', '0.0.0.0'],
    {
      cwd: ML_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) log('ML', line.trim(), colors.cyan);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) log('ML', line.trim(), colors.cyan);
    });
  });

  proc.on('close', (code) => {
    log('ML', `Process exited with code ${code}`, colors.yellow);
  });

  childProcesses.push(proc);
  return proc;
}

/**
 * 3. Start Backend REST API (Node Express on Port 5000)
 */
function startBackendService() {
  log('BACKEND', `Starting Express REST Server on port ${BACKEND_PORT}...`, colors.green);

  const proc = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(BACKEND_PORT) },
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) log('BACKEND', line.trim(), colors.green);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) log('BACKEND', line.trim(), colors.red);
    });
  });

  proc.on('close', (code) => {
    log('BACKEND', `Process exited with code ${code}`, colors.yellow);
  });

  childProcesses.push(proc);
  return proc;
}

function log(prefix, message, color = colors.reset) {
  const padPrefix = prefix.padEnd(8, ' ');
  console.log(`${color}${colors.bright}[${padPrefix}]${colors.reset} ${message}`);
}

// Open URL in default browser
function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      exec(`start ${url}`);
    } else if (platform === 'darwin') {
      exec(`open ${url}`);
    } else {
      exec(`xdg-open ${url}`);
    }
  } catch (e) {}
}

/**
 * Wait for an HTTP service to respond with HTTP 200 (database ready)
 */
function waitForHealth(url, maxAttempts = 30, intervalMs = 500) {
  return new Promise((resolve) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      http
        .get(url, (res) => {
          if (res.statusCode === 200) {
            clearInterval(timer);
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(timer);
            resolve(false);
          }
        })
        .on('error', () => {
          if (attempts >= maxAttempts) {
            clearInterval(timer);
            resolve(false);
          }
        });
    }, intervalMs);
  });
}

// Clean shutdown handler
function shutdown() {
  console.log(`\n${colors.yellow}Shutting down all Foodshare services...${colors.reset}`);

  childProcesses.forEach((proc) => {
    if (proc && !proc.killed) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        } catch (e) {}
      } else {
        try {
          proc.kill('SIGTERM');
        } catch (e) {}
      }
    }
  });

  console.log(`${colors.green}All services stopped cleanly. Goodbye!${colors.reset}\n`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  childProcesses.forEach((proc) => {
    if (proc && !proc.killed) {
      try {
        proc.kill();
      } catch (e) {}
    }
  });
});

// Launch All Services
startMlService();
startBackendService();
const frontendHttpServer = startFrontendServer();

// Wait for Backend to be fully ready before opening browser
(async () => {
  const isBackendHealthy = await waitForHealth(`http://127.0.0.1:${BACKEND_PORT}/api/health`, 20, 300);

  console.log(`\n${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bright} Foodshare Services Are Live!${colors.reset}`);
  console.log(`${colors.bright} 🌐 Frontend Application : ${colors.cyan}http://localhost:${FRONTEND_PORT}${colors.reset}`);
  console.log(`${colors.bright} 🔌 Backend REST APIs   : ${colors.green}http://localhost:${BACKEND_PORT}${colors.reset} (Health: ${isBackendHealthy ? 'Online' : 'Starting...'})`);
  console.log(`${colors.bright} 🧠 Python ML Service   : ${colors.yellow}http://localhost:${ML_PORT}${colors.reset} (Health: Online)`);
  console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(` Press ${colors.bright}Ctrl + C${colors.reset} at any time to gracefully terminate all services.\n`);

  openBrowser(`http://localhost:${FRONTEND_PORT}`);
})();
