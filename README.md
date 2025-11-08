# Google Search Console MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with the Google Search Console API. This server enables Claude and other MCP clients to access search analytics data, manage sitemaps, and inspect URLs.

## Features

- **List Sites**: Get all properties you have access to in Google Search Console
- **Search Analytics**: Query search performance data with customizable dimensions (queries, pages, countries, devices, etc.)
- **Sitemap Management**: List, submit, and delete sitemaps
- **URL Inspection**: Inspect individual URLs for indexing status and issues

## Prerequisites

- Node.js 18 or higher
- Google Cloud Project with Search Console API enabled
- OAuth 2.0 credentials (Client ID, Client Secret, and Refresh Token)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Search Console API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Search Console API"
   - Click "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Desktop app" as the application type
4. Name it (e.g., "Search Console MCP")
5. Click "Create"
6. Download the credentials JSON or note the Client ID and Client Secret

**Note**: You'll use these credentials with the OAuth Playground to get a refresh token. The redirect URI is only needed during that initial authorization step (handled by OAuth Playground), not for this MCP server.

### 4. Get Refresh Token

You need to obtain a refresh token using OAuth 2.0. Here's a simple way to do it:

1. Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1, find "Search Console API v1" and select:
   - `https://www.googleapis.com/auth/webmasters.readonly`
6. Click "Authorize APIs"
7. Sign in with your Google account
8. In Step 2, click "Exchange authorization code for tokens"
9. Copy the **Refresh token**

### 5. Set Environment Variables

Create a `.env` file or set the following environment variables:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_REFRESH_TOKEN="your-refresh-token"
```

**Note**: Since we're using refresh token flow (not interactive OAuth), no redirect URI is needed at runtime.

### 6. Build the Project

```bash
npm run build
```

## Configuration for Claude Desktop

Add this to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "node",
      "args": ["/absolute/path/to/google-search-console-mcp/dist/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REFRESH_TOKEN": "your-refresh-token"
      }
    }
  }
}
```

Replace `/absolute/path/to/google-search-console-mcp` with the actual path to this project.

## Available Tools

### list_sites

Lists all sites/properties you have access to in Google Search Console.

**Parameters**: None

**Example**:
```typescript
// Returns list of all sites
{
  "siteEntry": [
    {
      "siteUrl": "https://example.com/",
      "permissionLevel": "siteOwner"
    }
  ]
}
```

### get_search_analytics

Get search performance data for a specific site.

**Parameters**:
- `siteUrl` (required): The site URL (e.g., `https://example.com/` or `sc-domain:example.com`)
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format
- `dimensions` (optional): Array of dimensions to group by - `query`, `page`, `country`, `device`, `searchAppearance`, `date`
- `rowLimit` (optional): Max rows to return (default: 1000, max: 25000)
- `startRow` (optional): Pagination start row (default: 0)

**Example**:
```typescript
{
  "siteUrl": "https://example.com/",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "dimensions": ["query", "page"],
  "rowLimit": 100
}
```

### get_sitemaps

List all sitemaps for a site.

**Parameters**:
- `siteUrl` (required): The site URL

### submit_sitemap

Submit a sitemap to Google Search Console.

**Parameters**:
- `siteUrl` (required): The site URL
- `feedpath` (required): The sitemap URL

### delete_sitemap

Delete a sitemap from Google Search Console.

**Parameters**:
- `siteUrl` (required): The site URL
- `feedpath` (required): The sitemap URL to delete

### inspect_url

Inspect a URL for indexing status and issues.

**Parameters**:
- `siteUrl` (required): The site URL
- `inspectionUrl` (required): The URL to inspect

## Development

### Watch Mode

```bash
npm run watch
```

### Run in Development

```bash
npm run dev
```

## Troubleshooting

### Authentication Errors

If you get authentication errors:
1. Verify your Client ID, Client Secret, and Refresh Token are correct
2. Ensure the Search Console API is enabled in your Google Cloud project
3. Make sure your refresh token hasn't expired (they typically don't expire unless revoked)

### Permission Errors

Make sure the Google account associated with your refresh token has access to the Search Console properties you're trying to query.

### Rate Limits

The Search Console API has rate limits. If you hit them:
- Reduce the frequency of your requests
- Use smaller date ranges
- Implement exponential backoff for retries

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
