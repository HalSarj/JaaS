#!/usr/bin/env node

// Script to set up Dropbox folder monitoring for webhooks
// This needs to be run once to start monitoring the folder

const fs = require('fs');
const https = require('https');

// Read environment variables
const envContent = fs.readFileSync('.env', 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`${name}=(.+)`));
  return match ? match[1].trim() : null;
};

const ACCESS_TOKEN = getEnvVar('DROPBOX_ACCESS_TOKEN');
const FOLDER_PATH = ''; // Root directory where the .m4a files are actually located

// First let's check what folders exist in Apps
async function listAppsFolder() {
  try {
    console.log('Checking /Apps folder contents...');
    const appsContents = await makeDropboxRequest('files/list_folder', {
      path: '/Apps',
      recursive: false
    });
    
    console.log('Apps folder contents:');
    appsContents.entries.forEach(entry => {
      console.log(`  ${entry['.tag']}: ${entry.name}`);
    });
    
    return appsContents.entries;
  } catch (error) {
    console.log('Error listing Apps folder:', error.message);
    return [];
  }
}

if (!ACCESS_TOKEN) {
  console.error('DROPBOX_ACCESS_TOKEN not found in .env file');
  process.exit(1);
}

// Function to make API calls
function makeDropboxRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'api.dropboxapi.com',
      port: 443,
      path: `/2/${endpoint}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(parsedData)}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function setupFolderMonitoring() {
  console.log('Setting up Dropbox folder monitoring...');
  
  try {
    // Step 0: List root folder to see what's available
    console.log('Checking root folder contents...');
    const rootContents = await makeDropboxRequest('files/list_folder', {
      path: '',
      recursive: false
    });
    
    console.log('Root folder contents:');
    rootContents.entries.forEach(entry => {
      console.log(`  ${entry['.tag']}: ${entry.name}`);
    });
    
    // Step 1: Check if folder exists and list contents
    console.log(`\n1. Checking folder: ${FOLDER_PATH}`);
    
    const folderContents = await makeDropboxRequest('files/list_folder', {
      path: FOLDER_PATH,
      recursive: false
    });
    
    console.log(`✓ Folder exists with ${folderContents.entries.length} items`);
    
    // Show .m4a files
    const m4aFiles = folderContents.entries.filter(entry => 
      entry['.tag'] === 'file' && entry.name.endsWith('.m4a')
    );
    console.log(`✓ Found ${m4aFiles.length} .m4a files:`);
    m4aFiles.forEach(file => console.log(`  - ${file.name}`));
    
    // Step 2: Start monitoring the folder
    console.log('\n2. Starting folder monitoring...');
    
    const cursor = await makeDropboxRequest('files/list_folder/get_latest_cursor', {
      path: FOLDER_PATH,
      recursive: false
    });
    
    console.log(`✓ Folder monitoring started with cursor: ${cursor.cursor}`);
    
    // Step 3: Test webhook by uploading or modifying a file
    console.log('\n3. Setup complete!');
    console.log('Now try uploading a new .m4a file to your Dropbox folder.');
    console.log('The webhook should trigger and process the file automatically.');
    console.log('\nTo check if webhooks are working, monitor your Supabase function logs.');
    
  } catch (error) {
    console.error('Error setting up folder monitoring:', error.message);
    
    if (error.message.includes('missing_scope')) {
      console.error('\n❌ Permission Error:');
      console.error('1. Go to https://www.dropbox.com/developers/apps');
      console.error('2. Select your app');
      console.error('3. Go to Permissions tab');
      console.error('4. Enable "files.metadata.read" permission');
      console.error('5. Generate a new access token');
      console.error('6. Update your .env file with the new token');
    }
  }
}

setupFolderMonitoring();