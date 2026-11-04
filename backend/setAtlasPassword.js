/**
 * Foodshare - Secure Atlas Password Configuration Script
 * Prompts the user privately (masked input, never echoed to screen)
 * URL-encodes special characters, updates backend/.env safely,
 * and tests the MongoDB Atlas connection without logging secrets.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const { execSync } = require('child_process');

const ENV_PATH = path.join(__dirname, '.env');

function getHiddenInput(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Mask stdout while typing password
    const stdin = process.openStdin();
    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          break;
        default:
          process.stdout.write('\x1B[2K\x1B[200D' + promptText + '[' + '*'.repeat(rl.line.length) + ']');
          break;
      }
    };

    process.stdout.write(promptText);
    process.stdin.on('data', onData);

    rl.question('', (password) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      console.log('');
      resolve(password.trim());
    });
  });
}

async function run() {
  console.log('\n======================================================');
  console.log(' 🔒 Foodshare MongoDB Atlas Secure Password Setup');
  console.log('======================================================\n');

  if (!fs.existsSync(ENV_PATH)) {
    console.error('[Error] backend/.env file not found at:', ENV_PATH);
    process.exit(1);
  }

  // 1. Verify that backend/.env is excluded from Git
  try {
    const checkGit = execSync('git check-ignore backend/.env', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    if (checkGit.trim()) {
      console.log('✅ Git Safety: backend/.env is confirmed ignored by .gitignore.');
    }
  } catch (e) {
    // If command fails, verify via .gitignore
    const gitignorePath = path.join(__dirname, '..', '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (gitignoreContent.includes('.env')) {
        console.log('✅ Git Safety: .env exclusion confirmed in .gitignore.');
      }
    }
  }

  // 2. Read existing MONGODB_URI from .env
  const envContent = fs.readFileSync(ENV_PATH, 'utf8');
  const uriMatch = envContent.match(/MONGODB_URI=(.*)/);

  if (!uriMatch) {
    console.error('[Error] MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  const existingUri = uriMatch[1].trim();

  // 3. Prompt securely for password
  const rawPassword = await getHiddenInput('Enter your new MongoDB Atlas password: ');

  if (!rawPassword) {
    console.error('\n[Error] Password cannot be empty.');
    process.exit(1);
  }

  // 4. URL-encode special characters in password
  const encodedPassword = encodeURIComponent(rawPassword);

  // 5. Replace password while preserving cluster, username, dbName, and query params
  // Match format: mongodb+srv://<user>:<password>@<cluster>/<db>?<params>
  const uriRegex = /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/;

  let newUri;
  if (uriRegex.test(existingUri)) {
    newUri = existingUri.replace(uriRegex, `$1${encodedPassword}$3`);
  } else {
    // Fallback template
    newUri = `mongodb+srv://geethayazhini2006_db_user:${encodedPassword}@foodsharecluster.ztlxcla.mongodb.net/foodshare?retryWrites=true&w=majority`;
  }

  // Ensure dbName 'foodshare' is present in URI
  if (newUri.includes('.mongodb.net/') && !newUri.includes('.mongodb.net/foodshare')) {
    newUri = newUri.replace('.mongodb.net/', '.mongodb.net/foodshare');
  }

  // 6. Save updated URI to backend/.env
  const updatedEnvContent = envContent.replace(/MONGODB_URI=.*/, `MONGODB_URI=${newUri}`);
  fs.writeFileSync(ENV_PATH, updatedEnvContent, 'utf8');
  console.log('✅ Updated backend/.env with the encoded password.');

  // 7. Verify connection to Atlas without exposing credentials
  const safeHost = newUri.includes('@') ? newUri.split('@')[1] : 'MongoDB Atlas';
  console.log(`\nTesting connection to: ${safeHost}...`);

  try {
    await mongoose.connect(newUri, {
      dbName: 'foodshare',
      serverSelectionTimeoutMS: 10000,
    });

    const db = mongoose.connection.db;
    console.log('\n======================================================');
    console.log(' 🎉 CONNECTION SUCCESSFUL!');
    console.log(` Database: "${db.databaseName}"`);
    console.log(` Cluster Host: ${mongoose.connection.host}`);
    console.log('======================================================\n');

    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collection(s) in database "${db.databaseName}":`);
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(` • ${col.name} (${count} documents)`);
    }

    await mongoose.disconnect();
    console.log('\n[Status] Atlas setup complete. Ready for production deployment.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    console.log('Please verify your Atlas database user credentials or Network Access IP whitelist in Atlas.');
    process.exit(1);
  }
}

run();
