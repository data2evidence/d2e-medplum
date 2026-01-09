#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Installs Deno dependencies for all folders with deno.json files
 * 
 * This script:
 * - Scans the functions directory for folders with deno.json files
 * - Runs `deno install --allow-scripts` in each folder
 * - Provides detailed error reporting and summary
 * 
 * Usage:
 * - Normal run: ./install-deno-deps.js [functions-dir]
 * - If no functions-dir provided, defaults to './functions'
 */

// Function to print help information
function printHelp() {
  console.log('🔧 Install Deno Dependencies Script\n');
  console.log('USAGE:');
  console.log('  ./install-deno-deps.js <functions-dir>\n');
  console.log('ARGUMENTS:');
  console.log('  functions-dir    Path to the functions directory (required)\n');
  console.log('EXAMPLES:');
  console.log('  ./install-deno-deps.js ./functions     # Install deps in ./functions');
  console.log('  ./install-deno-deps.js ./my-functions  # Install deps in custom directory\n');
  console.log('DESCRIPTION:');
  console.log('  This script scans for folders with deno.json files and runs');
  console.log('  "deno install --allow-scripts" in each folder to install dependencies.');
  console.log('  Make sure to run ./transform-imports.js first to generate deno.json files.\n');
}

// Check for help flag or no arguments
if (process.argv.includes('--help') || process.argv.includes('-h') || process.argv.length === 2) {
  printHelp();
  process.exit(0);
}

// Require functions directory as first argument
const FUNCTIONS_DIR = process.argv[2];

function installDependencies(folderPath, errorSummary) {
  const folderName = path.basename(folderPath);
  const denoJsonPath = path.join(folderPath, 'deno.json');

  // Check if deno.json exists
  if (!fs.existsSync(denoJsonPath)) {
    console.log(`⚠️  No deno.json found in ${folderName}`);
    errorSummary.noDenoJson.push(folderName);
    return false;
  }

  try {
    console.log(`🔧 Installing dependencies for ${folderName}...`);
    
    // Run deno install with detailed output
    const result = execSync('deno install --allow-scripts', { 
      cwd: folderPath, 
      stdio: 'pipe',
      encoding: 'utf8'
    });

    console.log(`✅ Dependencies installed for ${folderName}`);
    
    // Show any output from deno install if it's informative
    if (result.trim()) {
      const lines = result.trim().split('\n');
      // Only show non-empty, meaningful lines
      const meaningfulLines = lines.filter(line => 
        line.trim() && 
        !line.includes('Download') && 
        !line.includes('Check')
      );
      
      if (meaningfulLines.length > 0) {
        console.log(`   ℹ️  ${meaningfulLines.join(', ')}`);
      }
    }

    errorSummary.success.push(folderName);
    return true;

  } catch (error) {
    console.error(`❌ Failed to install dependencies for ${folderName}`);
    
    // Extract meaningful error information
    let errorMessage = error.message;
    if (error.stderr) {
      errorMessage = error.stderr.toString().trim() || error.message;
    }
    
    // Show a concise error message
    const errorLines = errorMessage.split('\n');
    const mainError = errorLines.find(line => 
      line.includes('error:') || 
      line.includes('Error:') ||
      line.includes('Failed')
    ) || errorLines[0];
    console.log(errorMessage)
    console.error(`   💥 ${mainError}`);
    
    errorSummary.installFailed.push({
      folder: folderName,
      error: mainError
    });
    return false;
  }
}

function main() {
  console.log('\n🚀 Deno Dependency Installer\n');
  // Validate that functions directory argument is provided
  if (!FUNCTIONS_DIR) {
    console.error('❌ Functions directory argument is required.');
    console.error('💡 Usage: ./install-deno-deps.js <functions-dir>');
    console.error('💡 Use --help for more information.');
    process.exit(1);
  }

  console.log(`🔧 Installing Deno dependencies for all folders with deno.json in: ${FUNCTIONS_DIR}\n`);

  // Initialize error summary
  const errorSummary = {
    success: [],
    noDenoJson: [],
    installFailed: []
  };

  // Check if functions directory exists
  if (!fs.existsSync(FUNCTIONS_DIR)) {
    console.error(`❌ Functions directory not found: ${FUNCTIONS_DIR}`);
    console.error('💡 Usage: ./install-deno-deps.js <functions-dir>');
    console.error('💡 Make sure the directory path is correct.');
    process.exit(1);
  }

  // Get all subdirectories in functions
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  console.log('Directory entries:', entries.map(entry => `${entry.name}`));
  const foldersWithDenoJson = [];
  // Check if there's a deno.json file in the root directory
  const rootDenoJson = entries.find(entry => !entry.isDirectory() && entry.name === 'deno.json');
  if (rootDenoJson) {
    console.log(`📄 Found deno.json file in root directory: ${rootDenoJson.name}`);
    const folderPath = process.cwd();
    foldersWithDenoJson.push('.');
    installDependencies(folderPath, errorSummary);
  } else {
      const folders = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => !name.startsWith('_')); // Skip _shared and similar folders

      // Filter folders that have deno.json files
      foldersWithDenoJson = folders.filter(folderName => {
        const folderPath = path.join(FUNCTIONS_DIR, folderName);
        const denoJsonPath = path.join(folderPath, 'deno.json');
        return fs.existsSync(denoJsonPath);
      });

    console.log(`Found ${foldersWithDenoJson.length} folders with deno.json files:\n`);
    console.log(`${foldersWithDenoJson.join(', ')}\n`);

    if (foldersWithDenoJson.length === 0) {
      console.log(`🤷 No folders with deno.json files found in ${FUNCTIONS_DIR}.`);
      console.log(`💡 Run ./transform-imports.js ${FUNCTIONS_DIR} first to generate deno.json files.`);
      process.exit(0);
    }

    // Install dependencies for each folder
    foldersWithDenoJson.forEach(folderName => {
      const folderPath = path.join(FUNCTIONS_DIR, folderName);
      installDependencies(folderPath, errorSummary);
    });
  }
  console.log('\n🎉 Dependency installation completed!');

  // Display detailed summary
  console.log('\n📊 DETAILED SUMMARY:');
  
  if (errorSummary.success.length > 0) {
    console.log(`✅ Successfully installed: ${errorSummary.success.length} locations`);
    console.log(`   ${errorSummary.success.join(', ')}`);
  }

  if (errorSummary.noDenoJson.length > 0) {
    console.log(`\n⚠️  No deno.json found: ${errorSummary.noDenoJson.length} folders`);
    console.log(`   ${errorSummary.noDenoJson.join(', ')}`);
    console.log(`   💡 Run ./transform-imports.js ${FUNCTIONS_DIR} to create deno.json files`);
  }

  if (errorSummary.installFailed.length > 0) {
    console.log(`\n❌ Installation failed: ${errorSummary.installFailed.length} locations`);
    
    // Group by error type for better readability
    const errorGroups = {};
    errorSummary.installFailed.forEach(({ folder, error }) => {
      // Extract the main error type (remove specific details)
      let errorType = error;
      
      // Common error patterns
      if (error.includes('Permission denied')) {
        errorType = 'Permission denied';
      } else if (error.includes('network')) {
        errorType = 'Network error';
      } else if (error.includes('not found')) {
        errorType = 'Package not found';
      } else if (error.includes('version')) {
        errorType = 'Version conflict';
      } else {
        // Keep first line of error
        errorType = error.split('\n')[0].trim();
      }
      
      if (!errorGroups[errorType]) {
        errorGroups[errorType] = [];
      }
      errorGroups[errorType].push(folder);
    });

    Object.entries(errorGroups).forEach(([errorType, folders]) => {
      console.log(`   ${errorType}`);
      console.log(`     Affected folders: ${folders.join(', ')}`);
    });
  }

  // Final summary
  const totalProcessed = foldersWithDenoJson.length;
  const totalErrors = errorSummary.installFailed.length;
  
  console.log(`\n📈 FINAL TOTALS:`);
  console.log(`   Folders with deno.json: ${totalProcessed}`);
  console.log(`   Successfully installed: ${errorSummary.success.length}`);
  console.log(`   Installation failures: ${totalErrors}`);
  
  if (totalErrors === 0) {
    console.log('\n🎊 All dependencies installed successfully!');
    console.log('💡 Your Deno projects are ready to run!');
  } else {
    console.log(`\n🔧 ${totalErrors} folders need attention.`);
    console.log('💡 Check the error details above and resolve issues before running applications.');
  }

  // Exit with appropriate code
  process.exit(totalErrors > 0 ? 1 : 0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { installDependencies };