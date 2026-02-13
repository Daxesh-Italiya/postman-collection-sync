const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

// Configuration
const CONFIG = {
  apiKey: process.env.POSTMAN_API_KEY,
  workspaceName: process.env.WORKSPACE_NAME,
  collectionName: process.env.COLLECTION_NAME,
  collectionId: process.env.COLLECTION_ID, // Optional: Direct ID override
  outputDir: process.env.OUTPUT_DIR
    ? path.resolve(__dirname, process.env.OUTPUT_DIR)
    : path.join(__dirname, "api-documentation"),
  apiEndpointsDir: process.env.API_ENDPOINTS_DIR
    ? path.resolve(__dirname, process.env.API_ENDPOINTS_DIR)
    : null, // If null/empty, don't create API endpoint objects
};

// Validate Config
if (!CONFIG.apiKey) {
  console.error("❌ Error: POSTMAN_API_KEY is required in .env file");
  process.exit(1);
}

const api = axios.create({
  baseURL: "https://api.getpostman.com",
  headers: {
    "X-Api-Key": CONFIG.apiKey,
  },
});

// Helper: Ensure directory exists
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Step 1: Get Workspace ID (if not provided, maybe search or list)
// For simplicity, if workspaceName is provided, we search for it.
// Note: Postman API structure for workspaces is /workspaces
const getWorkspaceId = async () => {
  if (!CONFIG.workspaceName) return null;

  console.log(`🔍 Searching for workspace: "${CONFIG.workspaceName}"...`);
  try {
    const response = await api.get("/workspaces");
    const workspace = response.data.workspaces.find(
      (w) => w.name === CONFIG.workspaceName,
    );
    if (workspace) {
      return workspace.id;
    }
    console.warn(
      `⚠️  Workspace "${CONFIG.workspaceName}" not found. Searching all collections directly.`,
    );
    return null;
  } catch (error) {
    console.error("❌ Failed to fetch workspaces:", error.message);
    return null;
  }
};

// Step 2: Get Collection ID
const getCollectionId = async (workspaceId) => {
  if (CONFIG.collectionId) return CONFIG.collectionId;

  console.log(`🔍 Searching for collection: "${CONFIG.collectionName}"...`);
  if (!CONFIG.collectionName) {
    throw new Error(
      "Please provide either COLLECTION_ID or COLLECTION_NAME in .env",
    );
  }

  try {
    // Find in specific workspace or getAll
    const params = workspaceId ? { workspace: workspaceId } : {};
    const response = await api.get("/collections", { params });

    const collection = response.data.collections.find(
      (c) => c.name === CONFIG.collectionName,
    );
    if (collection) {
      return collection.uid; // Use UID for fetching details
    }
    throw new Error(`Collection "${CONFIG.collectionName}" not found.`);
  } catch (error) {
    console.error("❌ Failed to find collection:", error.message);
    throw error;
  }
};

// Step 3: Get Collection Details
const getCollectionDetails = async (collectionUid) => {
  console.log(`⬇️  Fetching collection details for UID: ${collectionUid}...`);
  try {
    const response = await api.get(`/collections/${collectionUid}`);
    return response.data.collection;
  } catch (error) {
    console.error("❌ Failed to fetch collection details:", error.message);
    throw error;
  }
};

// Step 4: Generate Markdown
const generateMarkdown = (item, savedPath) => {
  const request = item.request;
  if (!request) return;

  const method = request.method;
  const url = request.url?.raw || request.url;
  const description = request.description || "No description provided.";

  let mdContent = `# ${item.name}\n\n`;
  mdContent += `> ${description}\n\n`;
  mdContent += `\`${method}\` **${url}**\n\n`;

  // Headers
  if (request.header && request.header.length > 0) {
    mdContent += `## Headers\n\n`;
    mdContent += `| Key | Value | Description |\n`;
    mdContent += `| --- | --- | --- |\n`;
    request.header.forEach((h) => {
      mdContent += `| ${h.key} | ${h.value} | ${h.description || ""} |\n`;
    });
    mdContent += `\n`;
  }

  // Parameters (Query)
  if (request.url?.query && request.url.query.length > 0) {
    mdContent += `## Query Parameters\n\n`;
    mdContent += `| Key | Value | Description |\n`;
    mdContent += `| --- | --- | --- |\n`;
    request.url.query.forEach((p) => {
      mdContent += `| ${p.key} | ${p.value || ""} | ${p.description || ""} |\n`;
    });
    mdContent += `\n`;
  }

  // Body
  if (request.body && request.body.mode) {
    mdContent += `## Body (${request.body.mode})\n\n`;
    if (request.body.mode === "raw") {
      mdContent += `\`\`\`json\n${request.body.raw}\n\`\`\`\n\n`;
    } else if (request.body.mode === "formdata") {
      mdContent += `| Key | Value | Type | Description |\n`;
      mdContent += `| --- | --- | --- | --- |\n`;
      request.body.formdata.forEach((p) => {
        mdContent += `| ${p.key} | ${p.value || ""} | ${p.type} | ${p.description || ""} |\n`;
      });
      mdContent += `\n`;
    }
  }

  // Responses
  if (item.response && item.response.length > 0) {
    mdContent += `## Responses\n\n`;
    item.response.forEach((res) => {
      mdContent += `### ${res.name} (${res.code} ${res.status})\n\n`;
      mdContent += `\`\`\`json\n${res.body}\n\`\`\`\n\n`;
    });
  }

  const fileName = `${item.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
  fs.writeFileSync(path.join(savedPath, fileName), mdContent);
};

// Convert folder name to constant name (e.g., "user" -> "USER", "ComponentVersions" -> "COMPONENT_VERSIONS")
const toConstantName = (name) => {
  return name
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace special chars with underscore
    .replace(/([a-z])([A-Z])/g, "$1_$2") // Insert underscore between camelCase
    .toUpperCase();
};

// Convert request name to camelCase key (e.g., "Get All Users" -> "getAllUsers")
const toCamelCase = (str) => {
  return str
    .replace(/[^a-zA-Z0-9]/g, " ")
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
};

// Extract endpoint path from URL (removes base URL and query params)
const extractEndpoint = (url) => {
  if (!url) return "/";

  let pathStr = "";
  if (typeof url === "string") {
    pathStr = url;
  } else if (url.path) {
    pathStr = url.path.join("/");
  } else if (url.raw) {
    // Extract path from full URL
    try {
      const urlObj = new URL(url.raw);
      pathStr = urlObj.pathname;
    } catch {
      // If not a full URL, use raw
      pathStr = url.raw;
    }
  }

  // Remove query string
  pathStr = pathStr.split("?")[0];

  // Ensure path starts with /
  if (!pathStr.startsWith("/")) {
    pathStr = "/" + pathStr;
  }

  return pathStr;
};

// Generate API endpoint object file
const generateApiEndpointFile = (folderName, requests, outputPath) => {
  const constantName = toConstantName(folderName);
  const endpoints = {};

  requests.forEach((req) => {
    const key = toCamelCase(req.name);
    const method = req.request?.method || "GET";
    const endpointPath = extractEndpoint(req.request?.url);

    endpoints[key] = {
      type: method,
      endpoint: endpointPath,
    };
  });

  // Generate the file content
  const fileContent = `/**
 * ${folderName} API Endpoints
 */
export const ${constantName} = ${JSON.stringify(endpoints, null, 2).replace(/"([^"]+)":/g, "$1:")};

export default ${constantName};
`;

  const fileName = `${folderName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.js`;
  fs.writeFileSync(path.join(outputPath, fileName), fileContent);
  console.log(`  📝 Created: ${fileName}`);
};

// Collect requests from folders
const collectFolderRequests = (items, basePath, folderMap) => {
  items.forEach((item) => {
    if (item.item) {
      // It's a folder
      const folderName = item.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const folderPath = path.join(basePath, folderName);
      ensureDir(folderPath);

      // Collect all requests in this folder
      const requests = [];
      const collectRequests = (folderItems) => {
        folderItems.forEach((subItem) => {
          if (subItem.item) {
            // Nested folder - recurse
            collectRequests(subItem.item);
          } else if (subItem.request) {
            // It's a request
            requests.push(subItem);
            generateMarkdown(subItem, folderPath);
          }
        });
      };
      collectRequests(item.item);

      // Store requests for this folder
      if (!folderMap[folderName]) {
        folderMap[folderName] = [];
      }
      folderMap[folderName].push(...requests);

      processItems(item.item, folderPath, folderMap);
    } else if (item.request) {
      // It's a request at root level
      generateMarkdown(item, basePath);

      // Add to "general" folder for API endpoints
      if (!folderMap["general"]) {
        folderMap["general"] = [];
      }
      folderMap["general"].push(item);
    }
  });
};

// Recursively process items (Folders or Requests)
const processItems = (items, basePath) => {
  items.forEach((item) => {
    if (item.item) {
      // It's a folder
      const folderName = item.name.replace(/[^a-z0-9]/gi, "_");
      const folderPath = path.join(basePath, folderName);
      ensureDir(folderPath);
      processItems(item.item, folderPath);
    } else {
      // It's a request
      generateMarkdown(item, basePath);
    }
  });
};

const main = async () => {
  try {
    ensureDir(CONFIG.outputDir);

    const workspaceId = await getWorkspaceId();
    const collectionUid = await getCollectionId(workspaceId);
    const collection = await getCollectionDetails(collectionUid);

    // Save raw JSON
    fs.writeFileSync(
      path.join(CONFIG.outputDir, "collection.json"),
      JSON.stringify(collection, null, 2),
    );
    console.log(
      `✅ Collection JSON saved to ${path.relative(__dirname, CONFIG.outputDir)}/collection.json`,
    );

    // Generate Markdown and collect folder data
    console.log("📝 Generating Markdown documentation...");

    // If API endpoints dir is configured, use the new method
    if (CONFIG.apiEndpointsDir) {
      const folderMap = {};
      collectFolderRequests(collection.item, CONFIG.outputDir, folderMap);

      // Generate API endpoint files
      console.log("📝 Generating API endpoint files...");
      ensureDir(CONFIG.apiEndpointsDir);

      for (const [folderName, requests] of Object.entries(folderMap)) {
        if (requests.length > 0) {
          generateApiEndpointFile(folderName, requests, CONFIG.apiEndpointsDir);
        }
      }
      console.log(
        `✅ API endpoint files saved to ${path.relative(__dirname, CONFIG.apiEndpointsDir)}/`,
      );
    } else {
      // Just generate documentation
      processItems(collection.item, CONFIG.outputDir);
    }

    console.log("\n✨ Documentation sync complete!");
  } catch (error) {
    console.error("\n❌ Execution failed:", error.message);
    process.exit(1);
  }
};

main();
