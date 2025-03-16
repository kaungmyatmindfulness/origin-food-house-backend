require('dotenv').config();
const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const COLLECTION_ID = process.env.COLLECTION_ID;
const SWAGGER_URL =
  process.env.SWAGGER_URL || 'http://localhost:3000/api-docs-json';

// Temporary file paths
const SWAGGER_FILE = path.join(__dirname, 'swagger-temp.json');
const TEMP_COLLECTION = path.join(__dirname, 'temp-postman.json');
const FINAL_COLLECTION = path.join(__dirname, 'postman_collection.json');

// Helper to run a command-line process
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function main() {
  try {
    if (!POSTMAN_API_KEY || !COLLECTION_ID) {
      throw new Error('POSTMAN_API_KEY and COLLECTION_ID must be set in .env');
    }

    console.log(`Fetching Swagger JSON from: ${SWAGGER_URL}`);
    // 1. Fetch the Swagger JSON
    const swaggerRes = await fetch(SWAGGER_URL);
    if (!swaggerRes.ok) {
      throw new Error(
        `Failed to fetch swagger: ${swaggerRes.status} ${swaggerRes.statusText}`,
      );
    }
    const swaggerJson = await swaggerRes.text(); // raw text
    fs.writeFileSync(SWAGGER_FILE, swaggerJson, 'utf8');

    console.log('Swagger JSON saved to:', SWAGGER_FILE);

    // 2. Convert to Postman Collection with openapi-to-postmanv2
    console.log('Converting Swagger to Postman collection...');
    // npx openapi-to-postmanv2 -s swagger.json -o temp.json --pretty
    await runCommand(
      `npx openapi-to-postmanv2 -s "${SWAGGER_FILE}" -o "${TEMP_COLLECTION}" --pretty`,
    );

    // 3. Wrap the output in a complete "collection" structure
    console.log('Wrapping the Postman JSON properly...');
    const tempData = JSON.parse(fs.readFileSync(TEMP_COLLECTION, 'utf8'));

    // If the converter already returns { collection: { ... } }, check it:
    let finalData;
    if (tempData.collection) {
      // Already in expected form
      finalData = tempData;
    } else if (Array.isArray(tempData.item)) {
      // Possibly an object with { info, item } or just item
      finalData = {
        collection: {
          info: {
            name: 'My API Collection',
            schema:
              'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          ...tempData,
        },
      };
    } else {
      // Unrecognized shape
      throw new Error(
        'The output from openapi-to-postmanv2 is not recognized. Check your swagger file.',
      );
    }

    fs.writeFileSync(
      FINAL_COLLECTION,
      JSON.stringify(finalData, null, 2),
      'utf8',
    );
    console.log('Final Postman collection JSON:', FINAL_COLLECTION);

    // 4. PUT to the Postman API
    console.log('Updating collection in Postman...');
    const updateRes = await fetch(
      `https://api.getpostman.com/collections/${COLLECTION_ID}`,
      {
        method: 'PUT',
        headers: {
          'X-Api-Key': POSTMAN_API_KEY,
          'Content-Type': 'application/json',
        },
        body: fs.readFileSync(FINAL_COLLECTION, 'utf8'),
      },
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      throw new Error(
        `Failed to update Postman collection: ${updateRes.status} ${updateRes.statusText}\n${text}`,
      );
    }

    const updateJson = await updateRes.json();
    console.log('Postman collection updated successfully!', updateJson);
  } catch (err) {
    console.error('Error syncing Postman collection:', err.message);
    process.exit(1);
  } finally {
    // Clean up temporary files
    if (fs.existsSync(SWAGGER_FILE)) fs.unlinkSync(SWAGGER_FILE);
    if (fs.existsSync(TEMP_COLLECTION)) fs.unlinkSync(TEMP_COLLECTION);
    if (fs.existsSync(FINAL_COLLECTION)) fs.unlinkSync(FINAL_COLLECTION);
  }
}

main();
