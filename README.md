# Postman Collection Sync

Syncs a Postman Collection to local Markdown documentation.

## Requirements

*   Node.js (v14 or higher recommended)
*   npm (Node Package Manager)

## Why Use This? (AI Agent Context Gap)

Coding assistants (like GitHub Copilot, Cursor, or Agentic AI) often lack awareness of your external API documentation. Developers usually have to manually copy-paste JSON or explain endpoints, which is tedious and error-prone.

This tool automates the process:

1.  **Configure once**: Set your API Key and Collection details.
2.  **Sync anytime**: Run one command to fetch the latest API specs.
3.  **AI-Ready**: Generates structured Markdown files that are easily readable by LLMs, ensuring your AI assistant has the full context of your API to write accurate code.

## How to Generate Postman API Key

1.  Login to **Postman** in your web browser.
2.  Click on your **Profile Icon** (top right).
3.  Click on **Settings**.
4.  Click on **API Keys** in the menu.
5.  Click on **Generate API Key**.
6.  **Store the key properly** (it is only visible once).

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Create a `.env` file in this directory with the following variables:
    ```env
    POSTMAN_API_KEY=your_api_key_here
    # Optional: If you want to fetch by ID directly
    COLLECTION_ID=your_collection_uid
    # Optional: If you want to search by name
    WORKSPACE_NAME=My Workspace
    COLLECTION_NAME=My Collection
    ```

3.  **Run the Script**:
    ```bash
    npm start
    ```

## Output

The script will generate:
-   `api-documentation/collection.json`: The raw Postman collection backup.
-   `api-documentation/<Folder Name>/<Request Name>.md`: Detailed Markdown documentation for each request.

## Creator Info

**Name**: Daxesh Italiya
**Post**: Founder and CTO of TST-Technology
**LinkedIn**: [https://www.linkedin.com/in/daxesh-italiya/](https://www.linkedin.com/in/daxesh-italiya/)
**X (Twitter)**: [https://x.com/DaxeshI](https://x.com/DaxeshI)
**GitHub**: [https://github.com/Daxesh-Italiya](https://github.com/Daxesh-Italiya)
