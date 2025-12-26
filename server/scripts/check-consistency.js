#!/usr/bin/env node
/**
 * Consistency Checker for API Routes
 * Checks for common mistakes and inconsistencies
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ERRORS = [];
const WARNINGS = [];

console.log('🔍 Checking API consistency...\n');

// Check 1: req.user vs req.userId
function checkAuthUsage() {
  console.log('1️⃣ Checking authentication usage...');

  const routesDir = './routes';
  const files = getAllJsFiles(routesDir);

  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for req.user.id (WRONG)
      if (line.includes('req.user.id')) {
        ERRORS.push({
          file,
          line: index + 1,
          issue: 'Using req.user.id instead of req.userId',
          code: line.trim()
        });
      }

      // Check for req.user (might be OK in some contexts)
      if (line.includes('req.user') && !line.includes('req.userId') && !line.includes('//')) {
        WARNINGS.push({
          file,
          line: index + 1,
          issue: 'Using req.user - verify if this is correct',
          code: line.trim()
        });
      }
    });
  });
}

// Check 2: Database query consistency
function checkDatabaseUsage() {
  console.log('2️⃣ Checking database query patterns...');

  const routesDir = './routes';
  const files = getAllJsFiles(routesDir);

  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for mixing ? and $1 placeholders
      if (line.includes('db.') && line.includes('?') && line.includes('$1')) {
        ERRORS.push({
          file,
          line: index + 1,
          issue: 'Mixing ? and $N placeholders in same query',
          code: line.trim()
        });
      }
    });
  });
}

// Check 3: Error handling
function checkErrorHandling() {
  console.log('3️⃣ Checking error handling...');

  const routesDir = './routes';
  const files = getAllJsFiles(routesDir);

  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');

    // Count try-catch blocks
    const tryCount = (content.match(/try\s*{/g) || []).length;
    const catchCount = (content.match(/catch\s*\(/g) || []).length;

    if (tryCount !== catchCount) {
      ERRORS.push({
        file,
        line: 0,
        issue: `Unmatched try-catch blocks: ${tryCount} try, ${catchCount} catch`,
        code: ''
      });
    }

    // Check if async routes have error handling
    const lines = content.split('\n');
    let inAsyncRoute = false;
    let hasTryCatch = false;

    lines.forEach((line, index) => {
      if (line.includes('router.') && line.includes('async')) {
        inAsyncRoute = true;
        hasTryCatch = false;
      }

      if (inAsyncRoute && line.includes('try')) {
        hasTryCatch = true;
      }

      if (inAsyncRoute && line.includes('});')) {
        if (!hasTryCatch) {
          WARNINGS.push({
            file,
            line: index + 1,
            issue: 'Async route without try-catch block',
            code: ''
          });
        }
        inAsyncRoute = false;
      }
    });
  });
}

// Helper: Get all .js files recursively
function getAllJsFiles(dir, fileList = []) {
  const files = readdirSync(dir, { withFileTypes: true });

  files.forEach(file => {
    const filePath = join(dir, file.name);

    if (file.isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.name.endsWith('.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Run all checks
checkAuthUsage();
checkDatabaseUsage();
checkErrorHandling();

// Print results
console.log('\n' + '='.repeat(70));

if (ERRORS.length > 0) {
  console.log('\n❌ ERRORS FOUND:\n');
  ERRORS.forEach((error, i) => {
    console.log(`${i + 1}. ${error.file}:${error.line}`);
    console.log(`   Issue: ${error.issue}`);
    if (error.code) console.log(`   Code: ${error.code}`);
    console.log();
  });
} else {
  console.log('\n✅ No errors found!');
}

if (WARNINGS.length > 0) {
  console.log('\n⚠️  WARNINGS:\n');
  WARNINGS.forEach((warning, i) => {
    console.log(`${i + 1}. ${warning.file}:${warning.line}`);
    console.log(`   Issue: ${warning.issue}`);
    if (warning.code) console.log(`   Code: ${warning.code}`);
    console.log();
  });
} else {
  console.log('\n✅ No warnings!');
}

console.log('='.repeat(70));
console.log(`\nTotal: ${ERRORS.length} errors, ${WARNINGS.length} warnings\n`);

// Exit with error code if errors found
if (ERRORS.length > 0) {
  process.exit(1);
}
