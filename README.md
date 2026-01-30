# Postman Collection Sync

Syncs a Postman Collection to local Markdown documentation.

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
