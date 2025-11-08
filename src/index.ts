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
const SCOPES = ["https://www.googleapis.com/auth/webmasters"];

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

// Helper function to format dates
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to get date ranges
function getDateRange(type: string): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = formatDate(today);
  let startDate: string;

  switch (type) {
    case 'last7days':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      startDate = formatDate(sevenDaysAgo);
      break;
    case 'last30days':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      startDate = formatDate(thirtyDaysAgo);
      break;
    case 'last90days':
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      startDate = formatDate(ninetyDaysAgo);
      break;
    case 'lastMonth':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      startDate = formatDate(lastMonth);
      return { startDate, endDate: formatDate(lastMonthEnd) };
    case 'thisMonth':
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate = formatDate(thisMonthStart);
      break;
    case 'last3months':
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      startDate = formatDate(threeMonthsAgo);
      break;
    case 'last6months':
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(today.getMonth() - 6);
      startDate = formatDate(sixMonthsAgo);
      break;
    case 'lastYear':
      const lastYear = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      startDate = formatDate(lastYear);
      return { startDate, endDate: formatDate(lastYearEnd) };
    case 'thisYear':
      const thisYearStart = new Date(today.getFullYear(), 0, 1);
      startDate = formatDate(thisYearStart);
      break;
    case 'yearToDate':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      startDate = formatDate(yearStart);
      break;
    default:
      const defaultStart = new Date(today);
      defaultStart.setDate(today.getDate() - 7);
      startDate = formatDate(defaultStart);
  }

  return { startDate, endDate };
}

// Define available tools (90 tools)
const TOOLS: Tool[] = [
  // ===== CORE API TOOLS (11 tools) =====
  {
    name: "list_sites",
    description: "List all sites/properties in Google Search Console that the user has access to",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_site",
    description: "Get detailed information about a specific site",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL (e.g., 'https://example.com/' or 'sc-domain:example.com')",
        },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "add_site",
    description: "Add a site to the set of the user's sites in Search Console",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL to add",
        },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "delete_site",
    description: "Remove a site from the set of the user's Search Console sites",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL to delete",
        },
      },
      required: ["siteUrl"],
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
    name: "get_sitemap",
    description: "Get detailed information about a specific sitemap",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
        },
        feedpath: {
          type: "string",
          description: "The URL of the sitemap",
        },
      },
      required: ["siteUrl", "feedpath"],
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
  {
    name: "get_search_analytics",
    description: "Get search analytics data with customizable parameters",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
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
          description: "Dimensions to group by",
        },
        rowLimit: {
          type: "number",
          description: "Maximum number of rows (default: 1000, max: 25000)",
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
    name: "get_search_analytics_with_filters",
    description: "Get search analytics data with dimension filters",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: {
          type: "string",
          description: "The site URL",
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
          },
          description: "Dimensions to group by",
        },
        dimensionFilterGroups: {
          type: "array",
          items: {
            type: "object",
          },
          description: "Filter groups for filtering data",
        },
        rowLimit: {
          type: "number",
          description: "Maximum number of rows",
        },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },

  // ===== SINGLE DIMENSION ANALYTICS (6 tools) =====
  {
    name: "get_analytics_by_query",
    description: "Get search analytics grouped by search query",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site URL" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        rowLimit: { type: "number", description: "Max rows (default: 1000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_by_page",
    description: "Get search analytics grouped by page URL",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site URL" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        rowLimit: { type: "number", description: "Max rows (default: 1000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_by_country",
    description: "Get search analytics grouped by country",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site URL" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        rowLimit: { type: "number", description: "Max rows (default: 1000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_by_device",
    description: "Get search analytics grouped by device type",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site URL" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        rowLimit: { type: "number", description: "Max rows (default: 1000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_by_search_appearance",
    description: "Get search analytics grouped by search appearance type",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site URL" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        rowLimit: { type: "number", description: "Max rows (default: 1000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_by_date",
    description: "Get search analytics grouped by date (time series)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site URL" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        rowLimit: { type: "number", description: "Max rows (default: 1000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },

  // ===== MULTI-DIMENSION ANALYTICS (15 tools) =====
  {
    name: "get_analytics_query_by_page",
    description: "Get analytics grouped by query and page",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_by_country",
    description: "Get analytics grouped by query and country",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_by_device",
    description: "Get analytics grouped by query and device",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_page_by_country",
    description: "Get analytics grouped by page and country",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_page_by_device",
    description: "Get analytics grouped by page and device",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_country_by_device",
    description: "Get analytics grouped by country and device",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_page_country",
    description: "Get analytics grouped by query, page, and country",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_page_device",
    description: "Get analytics grouped by query, page, and device",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_country_device",
    description: "Get analytics grouped by query, country, and device",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_page_country_device",
    description: "Get analytics grouped by page, country, and device",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_by_date",
    description: "Get time series analytics grouped by query and date",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_page_by_date",
    description: "Get time series analytics grouped by page and date",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_country_by_date",
    description: "Get time series analytics grouped by country and date",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_device_by_date",
    description: "Get time series analytics grouped by device and date",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_all_dimensions",
    description: "Get analytics with all dimensions (query, page, country, device, date)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },

  // ===== TIME PERIOD HELPERS (10 tools) =====
  {
    name: "get_analytics_last_7_days",
    description: "Get analytics for the last 7 days",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_last_30_days",
    description: "Get analytics for the last 30 days",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_last_90_days",
    description: "Get analytics for the last 90 days",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_last_month",
    description: "Get analytics for the previous calendar month",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_this_month",
    description: "Get analytics for the current month to date",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_last_3_months",
    description: "Get analytics for the last 3 months",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_last_6_months",
    description: "Get analytics for the last 6 months",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_last_year",
    description: "Get analytics for the previous calendar year",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_this_year",
    description: "Get analytics for the current year to date",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_analytics_year_to_date",
    description: "Get analytics from January 1st of current year to today",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },

  // ===== FILTERED ANALYTICS (10 tools) =====
  {
    name: "get_analytics_for_specific_page",
    description: "Get analytics filtered to a specific page URL",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        pageUrl: { type: "string", description: "The specific page URL to filter" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "pageUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_for_specific_query",
    description: "Get analytics filtered to a specific search query",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        query: { type: "string", description: "The search query to filter" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "query", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_for_specific_country",
    description: "Get analytics filtered to a specific country",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        country: { type: "string", description: "3-letter country code (e.g., USA, GBR)" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "country", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_for_specific_device",
    description: "Get analytics filtered to a specific device type",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        device: { type: "string", description: "Device type: DESKTOP, MOBILE, or TABLET" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "device", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_query_contains",
    description: "Get analytics for queries containing specific text",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        queryPattern: { type: "string", description: "Text that queries must contain" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "queryPattern", "startDate", "endDate"],
    },
  },
  {
    name: "get_analytics_page_contains",
    description: "Get analytics for pages containing specific URL pattern",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        urlPattern: { type: "string", description: "URL pattern pages must contain" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "urlPattern", "startDate", "endDate"],
    },
  },
  {
    name: "get_mobile_analytics",
    description: "Get analytics filtered to mobile devices only",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_desktop_analytics",
    description: "Get analytics filtered to desktop devices only",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_tablet_analytics",
    description: "Get analytics filtered to tablet devices only",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_branded_vs_nonbranded_queries",
    description: "Get analytics comparing branded vs non-branded queries",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        brandTerms: { type: "array", items: { type: "string" }, description: "Brand terms to identify branded queries" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "brandTerms", "startDate", "endDate"],
    },
  },

  // ===== ADVANCED ANALYTICS (10 tools) =====
  {
    name: "get_top_queries",
    description: "Get top performing queries by clicks",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", description: "Number of top queries (default: 10)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_top_pages",
    description: "Get top performing pages by clicks",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        limit: { type: "number", description: "Number of top pages (default: 10)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_queries_with_high_impressions_low_clicks",
    description: "Find queries with high impressions but low CTR (opportunity queries)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        minImpressions: { type: "number", description: "Minimum impressions threshold (default: 100)" },
        maxCTR: { type: "number", description: "Maximum CTR threshold (default: 0.05)" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_queries_with_high_position",
    description: "Get queries ranking in top positions (1-3)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        maxPosition: { type: "number", description: "Maximum position (default: 3)" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_queries_with_low_position",
    description: "Get queries ranking in lower positions (opportunity for improvement)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        minPosition: { type: "number", description: "Minimum position (default: 10)" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_pages_with_declining_traffic",
    description: "Identify pages with declining traffic (comparing two periods)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        currentStartDate: { type: "string" },
        currentEndDate: { type: "string" },
        previousStartDate: { type: "string" },
        previousEndDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "currentStartDate", "currentEndDate", "previousStartDate", "previousEndDate"],
    },
  },
  {
    name: "get_pages_with_growing_traffic",
    description: "Identify pages with growing traffic (comparing two periods)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        currentStartDate: { type: "string" },
        currentEndDate: { type: "string" },
        previousStartDate: { type: "string" },
        previousEndDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "currentStartDate", "currentEndDate", "previousStartDate", "previousEndDate"],
    },
  },
  {
    name: "get_performance_summary",
    description: "Get overall performance summary with totals",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_country_performance_summary",
    description: "Get performance summary broken down by country",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_device_performance_summary",
    description: "Get performance summary broken down by device type",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },

  // ===== COMPARISON & ANALYSIS TOOLS (8 tools) =====
  {
    name: "compare_periods",
    description: "Compare analytics between two time periods",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        currentStartDate: { type: "string" },
        currentEndDate: { type: "string" },
        previousStartDate: { type: "string" },
        previousEndDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "currentStartDate", "currentEndDate", "previousStartDate", "previousEndDate"],
    },
  },
  {
    name: "compare_countries",
    description: "Compare performance across multiple countries",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        countries: { type: "array", items: { type: "string" }, description: "Array of country codes" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "countries", "startDate", "endDate"],
    },
  },
  {
    name: "compare_devices",
    description: "Compare performance across device types",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "compare_pages",
    description: "Compare performance of multiple specific pages",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        pageUrls: { type: "array", items: { type: "string" }, description: "Array of page URLs" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "pageUrls", "startDate", "endDate"],
    },
  },
  {
    name: "get_year_over_year_comparison",
    description: "Compare current period with same period last year",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "get_month_over_month_comparison",
    description: "Compare current month with previous month",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "get_week_over_week_comparison",
    description: "Compare last 7 days with previous 7 days",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        dimensions: { type: "array", items: { type: "string" } },
        rowLimit: { type: "number" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "analyze_query_performance_trend",
    description: "Analyze performance trend for a specific query over time",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        query: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "query", "startDate", "endDate"],
    },
  },

  // ===== URL INSPECTION & TESTING (5 tools) =====
  {
    name: "inspect_url_indexing",
    description: "Get detailed indexing information for a URL",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        inspectionUrl: { type: "string" },
      },
      required: ["siteUrl", "inspectionUrl"],
    },
  },
  {
    name: "bulk_inspect_urls",
    description: "Inspect multiple URLs at once",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        urls: { type: "array", items: { type: "string" }, description: "Array of URLs to inspect" },
      },
      required: ["siteUrl", "urls"],
    },
  },
  {
    name: "get_crawl_stats",
    description: "Get overall crawl statistics for the site (via aggregated analytics)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "find_pages_not_indexed",
    description: "Find pages that appear in analytics but may have indexing issues",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        pageUrls: { type: "array", items: { type: "string" } },
      },
      required: ["siteUrl", "startDate", "endDate", "pageUrls"],
    },
  },
  {
    name: "get_indexing_coverage_summary",
    description: "Get summary of indexing coverage based on submitted sitemaps",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
      },
      required: ["siteUrl"],
    },
  },

  // ===== BATCH & EXPORT OPERATIONS (5 tools) =====
  {
    name: "export_all_queries",
    description: "Export all queries data (paginated, up to max limit)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        maxRows: { type: "number", description: "Max rows to export (up to 25000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "export_all_pages",
    description: "Export all pages data (paginated, up to max limit)",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        maxRows: { type: "number", description: "Max rows to export (up to 25000)" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "bulk_submit_sitemaps",
    description: "Submit multiple sitemaps at once",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        feedpaths: { type: "array", items: { type: "string" }, description: "Array of sitemap URLs" },
      },
      required: ["siteUrl", "feedpaths"],
    },
  },
  {
    name: "bulk_delete_sitemaps",
    description: "Delete multiple sitemaps at once",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        feedpaths: { type: "array", items: { type: "string" }, description: "Array of sitemap URLs" },
      },
      required: ["siteUrl", "feedpaths"],
    },
  },
  {
    name: "get_complete_site_audit",
    description: "Get comprehensive site audit including analytics, sitemaps, and top content",
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "google-search-console-mcp",
    version: "2.0.0",
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
    const args = request.params.arguments as any;

    switch (request.params.name) {
      // ===== CORE API TOOLS =====
      case "list_sites": {
        const response = await searchconsole.sites.list({ auth: authClient });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_site": {
        const response = await searchconsole.sites.get({
          auth: authClient,
          siteUrl: args.siteUrl,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "add_site": {
        const response = await searchconsole.sites.add({
          auth: authClient,
          siteUrl: args.siteUrl,
        });
        return {
          content: [{ type: "text", text: `Site ${args.siteUrl} added successfully` }],
        };
      }

      case "delete_site": {
        await searchconsole.sites.delete({
          auth: authClient,
          siteUrl: args.siteUrl,
        });
        return {
          content: [{ type: "text", text: `Site ${args.siteUrl} deleted successfully` }],
        };
      }

      case "get_sitemaps": {
        const response = await searchconsole.sitemaps.list({
          auth: authClient,
          siteUrl: args.siteUrl,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_sitemap": {
        const response = await searchconsole.sitemaps.get({
          auth: authClient,
          siteUrl: args.siteUrl,
          feedpath: args.feedpath,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "submit_sitemap": {
        await searchconsole.sitemaps.submit({
          auth: authClient,
          siteUrl: args.siteUrl,
          feedpath: args.feedpath,
        });
        return {
          content: [{ type: "text", text: `Sitemap ${args.feedpath} submitted successfully` }],
        };
      }

      case "delete_sitemap": {
        await searchconsole.sitemaps.delete({
          auth: authClient,
          siteUrl: args.siteUrl,
          feedpath: args.feedpath,
        });
        return {
          content: [{ type: "text", text: `Sitemap ${args.feedpath} deleted successfully` }],
        };
      }

      case "inspect_url": {
        const response = await searchconsole.urlInspection.index.inspect({
          auth: authClient,
          requestBody: {
            inspectionUrl: args.inspectionUrl,
            siteUrl: args.siteUrl,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_search_analytics": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
            startRow: args.startRow || 0,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_search_analytics_with_filters": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions,
            dimensionFilterGroups: args.dimensionFilterGroups,
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ===== SINGLE DIMENSION ANALYTICS =====
      case "get_analytics_by_query": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_by_page": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_by_country": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["country"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_by_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_by_search_appearance": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["searchAppearance"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_by_date": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["date"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ===== MULTI-DIMENSION ANALYTICS =====
      case "get_analytics_query_by_page": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "page"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_by_country": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "country"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_by_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_page_by_country": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page", "country"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_page_by_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page", "device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_country_by_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["country", "device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_page_country": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "page", "country"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_page_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "page", "device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_country_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "country", "device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_page_country_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page", "country", "device"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_by_date": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "date"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_page_by_date": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page", "date"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_country_by_date": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["country", "date"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_device_by_date": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["device", "date"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_all_dimensions": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query", "page", "country", "device", "date"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ===== TIME PERIOD HELPERS =====
      case "get_analytics_last_7_days": {
        const dateRange = getDateRange('last7days');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_last_30_days": {
        const dateRange = getDateRange('last30days');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_last_90_days": {
        const dateRange = getDateRange('last90days');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_last_month": {
        const dateRange = getDateRange('lastMonth');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_this_month": {
        const dateRange = getDateRange('thisMonth');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_last_3_months": {
        const dateRange = getDateRange('last3months');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_last_6_months": {
        const dateRange = getDateRange('last6months');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_last_year": {
        const dateRange = getDateRange('lastYear');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_this_year": {
        const dateRange = getDateRange('thisYear');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_year_to_date": {
        const dateRange = getDateRange('yearToDate');
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: args.dimensions || ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ===== FILTERED ANALYTICS =====
      case "get_analytics_for_specific_page": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "page",
                operator: "equals",
                expression: args.pageUrl,
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_for_specific_query": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["page"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "query",
                operator: "equals",
                expression: args.query,
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_for_specific_country": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "country",
                operator: "equals",
                expression: args.country,
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_for_specific_device": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "device",
                operator: "equals",
                expression: args.device,
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_query_contains": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "query",
                operator: "contains",
                expression: args.queryPattern,
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_analytics_page_contains": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "page",
                operator: "contains",
                expression: args.urlPattern,
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_mobile_analytics": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "device",
                operator: "equals",
                expression: "MOBILE",
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_desktop_analytics": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "device",
                operator: "equals",
                expression: "DESKTOP",
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_tablet_analytics": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: args.dimensions || ["query"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "device",
                operator: "equals",
                expression: "TABLET",
              }],
            }],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_branded_vs_nonbranded_queries": {
        // Get all queries
        const allQueries = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });

        // Separate branded vs non-branded
        const brandTermsLower = args.brandTerms.map((t: string) => t.toLowerCase());
        const branded: any[] = [];
        const nonBranded: any[] = [];

        allQueries.data.rows?.forEach((row: any) => {
          const query = row.keys[0].toLowerCase();
          const isBranded = brandTermsLower.some((term: string) => query.includes(term));
          if (isBranded) {
            branded.push(row);
          } else {
            nonBranded.push(row);
          }
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              branded: { count: branded.length, rows: branded },
              nonBranded: { count: nonBranded.length, rows: nonBranded },
            }, null, 2),
          }],
        };
      }

      // ===== ADVANCED ANALYTICS =====
      case "get_top_queries": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: args.limit || 10,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_top_pages": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page"],
            rowLimit: args.limit || 10,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_queries_with_high_impressions_low_clicks": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });

        const minImpressions = args.minImpressions || 100;
        const maxCTR = args.maxCTR || 0.05;

        const opportunities = response.data.rows?.filter((row: any) =>
          row.impressions >= minImpressions && row.ctr <= maxCTR
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ rows: opportunities }, null, 2),
          }],
        };
      }

      case "get_queries_with_high_position": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });

        const maxPosition = args.maxPosition || 3;
        const topQueries = response.data.rows?.filter((row: any) =>
          row.position <= maxPosition
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ rows: topQueries }, null, 2),
          }],
        };
      }

      case "get_queries_with_low_position": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });

        const minPosition = args.minPosition || 10;
        const lowQueries = response.data.rows?.filter((row: any) =>
          row.position >= minPosition
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ rows: lowQueries }, null, 2),
          }],
        };
      }

      case "get_pages_with_declining_traffic": {
        const [current, previous] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.currentStartDate,
              endDate: args.currentEndDate,
              dimensions: ["page"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.previousStartDate,
              endDate: args.previousEndDate,
              dimensions: ["page"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
        ]);

        const previousMap = new Map(
          previous.data.rows?.map((r: any) => [r.keys[0], r.clicks]) || []
        );

        const declining = current.data.rows?.filter((row: any) => {
          const prevClicks = previousMap.get(row.keys[0]) || 0;
          return row.clicks < prevClicks;
        }).map((row: any) => ({
          ...row,
          previousClicks: previousMap.get(row.keys[0]),
          change: row.clicks - (previousMap.get(row.keys[0]) || 0),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ rows: declining }, null, 2),
          }],
        };
      }

      case "get_pages_with_growing_traffic": {
        const [current, previous] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.currentStartDate,
              endDate: args.currentEndDate,
              dimensions: ["page"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.previousStartDate,
              endDate: args.previousEndDate,
              dimensions: ["page"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
        ]);

        const previousMap = new Map(
          previous.data.rows?.map((r: any) => [r.keys[0], r.clicks]) || []
        );

        const growing = current.data.rows?.filter((row: any) => {
          const prevClicks = previousMap.get(row.keys[0]) || 0;
          return row.clicks > prevClicks;
        }).map((row: any) => ({
          ...row,
          previousClicks: previousMap.get(row.keys[0]),
          change: row.clicks - (previousMap.get(row.keys[0]) || 0),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ rows: growing }, null, 2),
          }],
        };
      }

      case "get_performance_summary": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: [],
            rowLimit: 1,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_country_performance_summary": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["country"],
            rowLimit: Math.min(args.rowLimit || 1000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "get_device_performance_summary": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["device"],
            rowLimit: 3,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ===== COMPARISON & ANALYSIS TOOLS =====
      case "compare_periods": {
        const [current, previous] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.currentStartDate,
              endDate: args.currentEndDate,
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.previousStartDate,
              endDate: args.previousEndDate,
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              current: current.data,
              previous: previous.data,
            }, null, 2),
          }],
        };
      }

      case "compare_countries": {
        const results = await Promise.all(
          args.countries.map((country: string) =>
            searchconsole.searchanalytics.query({
              auth: authClient,
              siteUrl: args.siteUrl,
              requestBody: {
                startDate: args.startDate,
                endDate: args.endDate,
                dimensions: [],
                dimensionFilterGroups: [{
                  filters: [{
                    dimension: "country",
                    operator: "equals",
                    expression: country,
                  }],
                }],
              },
            }).then(r => ({ country, data: r.data }))
          )
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "compare_devices": {
        const devices = ["DESKTOP", "MOBILE", "TABLET"];
        const results = await Promise.all(
          devices.map(device =>
            searchconsole.searchanalytics.query({
              auth: authClient,
              siteUrl: args.siteUrl,
              requestBody: {
                startDate: args.startDate,
                endDate: args.endDate,
                dimensions: [],
                dimensionFilterGroups: [{
                  filters: [{
                    dimension: "device",
                    operator: "equals",
                    expression: device,
                  }],
                }],
              },
            }).then(r => ({ device, data: r.data }))
          )
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "compare_pages": {
        const results = await Promise.all(
          args.pageUrls.map((pageUrl: string) =>
            searchconsole.searchanalytics.query({
              auth: authClient,
              siteUrl: args.siteUrl,
              requestBody: {
                startDate: args.startDate,
                endDate: args.endDate,
                dimensions: [],
                dimensionFilterGroups: [{
                  filters: [{
                    dimension: "page",
                    operator: "equals",
                    expression: pageUrl,
                  }],
                }],
              },
            }).then(r => ({ pageUrl, data: r.data }))
          )
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "get_year_over_year_comparison": {
        const currentYear = new Date(args.startDate);
        const lastYear = new Date(currentYear);
        lastYear.setFullYear(currentYear.getFullYear() - 1);

        const [current, previous] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.startDate,
              endDate: args.endDate,
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: formatDate(lastYear),
              endDate: formatDate(new Date(new Date(args.endDate).setFullYear(new Date(args.endDate).getFullYear() - 1))),
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              currentYear: current.data,
              previousYear: previous.data,
            }, null, 2),
          }],
        };
      }

      case "get_month_over_month_comparison": {
        const today = new Date();
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        const [current, previous] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: formatDate(thisMonthStart),
              endDate: formatDate(today),
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: formatDate(lastMonthStart),
              endDate: formatDate(lastMonthEnd),
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              thisMonth: current.data,
              lastMonth: previous.data,
            }, null, 2),
          }],
        };
      }

      case "get_week_over_week_comparison": {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(today.getDate() - 14);

        const [current, previous] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: formatDate(sevenDaysAgo),
              endDate: formatDate(today),
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: formatDate(fourteenDaysAgo),
              endDate: formatDate(sevenDaysAgo),
              dimensions: args.dimensions || ["query"],
              rowLimit: Math.min(args.rowLimit || 1000, 25000),
            },
          }),
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              lastWeek: current.data,
              previousWeek: previous.data,
            }, null, 2),
          }],
        };
      }

      case "analyze_query_performance_trend": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["date"],
            dimensionFilterGroups: [{
              filters: [{
                dimension: "query",
                operator: "equals",
                expression: args.query,
              }],
            }],
            rowLimit: 365,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      // ===== URL INSPECTION & TESTING =====
      case "inspect_url_indexing": {
        const response = await searchconsole.urlInspection.index.inspect({
          auth: authClient,
          requestBody: {
            inspectionUrl: args.inspectionUrl,
            siteUrl: args.siteUrl,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "bulk_inspect_urls": {
        const results = await Promise.all(
          args.urls.map((url: string) =>
            searchconsole.urlInspection.index.inspect({
              auth: authClient,
              requestBody: {
                inspectionUrl: url,
                siteUrl: args.siteUrl,
              },
            }).then(r => ({ url, data: r.data }))
            .catch(e => ({ url, error: e.message }))
          )
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "get_crawl_stats": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["date"],
            rowLimit: 365,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "find_pages_not_indexed": {
        const results = await Promise.all(
          args.pageUrls.map((url: string) =>
            searchconsole.urlInspection.index.inspect({
              auth: authClient,
              requestBody: {
                inspectionUrl: url,
                siteUrl: args.siteUrl,
              },
            }).then(r => ({
              url,
              indexed: r.data.inspectionResult?.indexStatusResult?.coverageState === 'Submitted and indexed',
              data: r.data
            }))
            .catch(e => ({ url, error: e.message }))
          )
        );

        const notIndexed = results.filter(r => !r.indexed);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ notIndexed, total: results.length }, null, 2),
          }],
        };
      }

      case "get_indexing_coverage_summary": {
        const sitemaps = await searchconsole.sitemaps.list({
          auth: authClient,
          siteUrl: args.siteUrl,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(sitemaps.data, null, 2) }],
        };
      }

      // ===== BATCH & EXPORT OPERATIONS =====
      case "export_all_queries": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["query"],
            rowLimit: Math.min(args.maxRows || 25000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "export_all_pages": {
        const response = await searchconsole.searchanalytics.query({
          auth: authClient,
          siteUrl: args.siteUrl,
          requestBody: {
            startDate: args.startDate,
            endDate: args.endDate,
            dimensions: ["page"],
            rowLimit: Math.min(args.maxRows || 25000, 25000),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case "bulk_submit_sitemaps": {
        const results = await Promise.all(
          args.feedpaths.map((feedpath: string) =>
            searchconsole.sitemaps.submit({
              auth: authClient,
              siteUrl: args.siteUrl,
              feedpath,
            }).then(() => ({ feedpath, success: true }))
            .catch(e => ({ feedpath, success: false, error: e.message }))
          )
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "bulk_delete_sitemaps": {
        const results = await Promise.all(
          args.feedpaths.map((feedpath: string) =>
            searchconsole.sitemaps.delete({
              auth: authClient,
              siteUrl: args.siteUrl,
              feedpath,
            }).then(() => ({ feedpath, success: true }))
            .catch(e => ({ feedpath, success: false, error: e.message }))
          )
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "get_complete_site_audit": {
        const [summary, topQueries, topPages, sitemaps, deviceBreakdown] = await Promise.all([
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.startDate,
              endDate: args.endDate,
              dimensions: [],
              rowLimit: 1,
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.startDate,
              endDate: args.endDate,
              dimensions: ["query"],
              rowLimit: 10,
            },
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.startDate,
              endDate: args.endDate,
              dimensions: ["page"],
              rowLimit: 10,
            },
          }),
          searchconsole.sitemaps.list({
            auth: authClient,
            siteUrl: args.siteUrl,
          }),
          searchconsole.searchanalytics.query({
            auth: authClient,
            siteUrl: args.siteUrl,
            requestBody: {
              startDate: args.startDate,
              endDate: args.endDate,
              dimensions: ["device"],
              rowLimit: 3,
            },
          }),
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              summary: summary.data,
              topQueries: topQueries.data,
              topPages: topPages.data,
              sitemaps: sitemaps.data,
              deviceBreakdown: deviceBreakdown.data,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stack || ""}`,
      }],
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
