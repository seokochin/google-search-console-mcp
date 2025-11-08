#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// Google Search Console API setup
const searchconsole = google.searchconsole("v1");
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

// Initialize OAuth2 client
let auth: OAuth2Client | null = null;

// Initialize OAuth2 client from environment variables
function getAuth(): OAuth2Client {
  if (auth) return auth;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return auth;
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "list_sites",
    description:
      "List all sites/properties in Google Search Console that the user has access to",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_search_analytics",
    description:
      "Get search analytics data (queries, pages, clicks, impressions, CTR, position) for a site",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL (e.g., 'https://example.com/' or 'sc-domain:example.com')",
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        dimensions: {
          type: "array",
          items: {
            type: "string",
            enum: ["query", "page", "country", "device", "searchAppearance", "date"],
          },
          description: "Dimensions to group by (e.g., ['query', 'page'])",
        },
        rowLimit: {
          type: "number",
          description: "Maximum number of rows to return (default: 1000, max: 25000)",
        },
        startRow: {
          type: "number",
          description: "Start row for pagination (default: 0)",
        },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_sitemaps",
    description: "List all sitemaps for a site",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
        },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "submit_sitemap",
    description: "Submit a sitemap to Google Search Console",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
        },
        feedpath: {
          type: "string",
          description: "The URL of the sitemap to submit",
        },
      },
      required: ["siteUrl", "feedpath"],
    },
  },
  {
    name: "delete_sitemap",
    description: "Delete a sitemap from Google Search Console",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
        },
        feedpath: {
          type: "string",
          description: "The URL of the sitemap to delete",
        },
      },
      required: ["siteUrl", "feedpath"],
    },
  },
  {
    name: "inspect_url",
    description: "Inspect a URL using the URL Inspection API",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
        },
        inspectionUrl: {
          type: "string",
          description: "The URL to inspect",
        },
      },
      required: ["siteUrl", "inspectionUrl"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "google-search-console-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const authClient = getAuth();

    switch (request.params.name) {
      case "list_sites": {
        const response = await searchconsole.sites.list({
          auth: authClient,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "get_search_analytics": {
        const {
          siteUrl,
          startDate,
          endDate,
          dimensions = ["query"],
          rowLimit = 1000,
          startRow = 0,
        } = request.params.arguments as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          dimensions?: string[];
          rowLimit?: number;
          startRow?: number;
        };

        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions,
            rowLimit: Math.min(rowLimit, 25000),
            startRow,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "get_sitemaps": {
        const { siteUrl } = request.params.arguments as { siteUrl: string };

        const response = await searchconsole.sitemaps.list({
          auth: authClient,
          siteUrl,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      case "submit_sitemap": {
        const { siteUrl, feedpath } = request.params.arguments as {
          siteUrl: string;
          feedpath: string;
        };

        await searchconsole.sitemaps.submit({
          auth: authClient,
          siteUrl,
          feedpath,
        });

        return {
          content: [
            {
              type: "text",
              text: `Sitemap ${feedpath} submitted successfully to ${siteUrl}`,
            },
          ],
        };
      }

      case "delete_sitemap": {
        const { siteUrl, feedpath } = request.params.arguments as {
          siteUrl: string;
          feedpath: string;
        };

        await searchconsole.sitemaps.delete({
          auth: authClient,
          siteUrl,
          feedpath,
        });

        return {
          content: [
            {
              type: "text",
              text: `Sitemap ${feedpath} deleted successfully from ${siteUrl}`,
            },
          ],
        };
      }

      case "inspect_url": {
        const { siteUrl, inspectionUrl } = request.params.arguments as {
          siteUrl: string;
          inspectionUrl: string;
        };

        const response = await searchconsole.urlInspection.index.inspect({
          auth: authClient,
          requestBody: {
            inspectionUrl,
            siteUrl,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}\n${error.stack || ""}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Search Console MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
