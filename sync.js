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
      `✅ Collection JSON saved to api-documentation/collection.json`,
    );

    // Generate Markdown
    console.log("📝 Generating Markdown documentation...");
    processItems(collection.item, CONFIG.outputDir);

    console.log("\n✨ Documentation sync complete!");
  } catch (error) {
    console.error("\n❌ Execution failed:", error.message);
    process.exit(1);
  }
};

main();
