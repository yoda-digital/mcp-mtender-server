import { 
  ListResourcesRequestSchema, 
  ListResourceTemplatesRequestSchema, 
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { axiosInstance, MTENDER_API_BASE_URL } from "../api/mtender-client.js";
import { createLoggingHandler } from "./utils.js";

/**
 * Handler for listing available resource templates.
 * Exposes a template for accessing tender data by OCID.
 */
export function setupResourceHandlers(server: any) {
  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    createLoggingHandler('ListResourceTemplates', async () => {
      return {
        resourceTemplates: [
          {
            uriTemplate: "mtender://tender/{ocid}",
            name: "Tender by OCID",
            mimeType: "application/json",
            description: "Access tender data by Open Contracting ID (OCID)"
          },
          {
            uriTemplate: "mtender://budget/{ocid}",
            name: "Budget by OCID",
            mimeType: "application/json",
            description: "Access budget data by Open Contracting ID (OCID)"
          },
          {
            uriTemplate: "mtender://funding/{ocid}",
            name: "Funding Source by OCID",
            mimeType: "application/json",
            description: "Access funding source data by Open Contracting ID (OCID)"
          }
        ]
      };
    })
  );

  /**
   * Handler for listing available resources.
   * Exposes a resource for the latest tenders.
   */
  server.setRequestHandler(
    ListResourcesRequestSchema,
    createLoggingHandler('ListResources', async () => {
      return {
        resources: [
          {
            uri: "mtender://latest-tenders",
            mimeType: "application/json",
            name: "Latest Tenders",
            description: "List of the most recent tenders in the MTender system"
          }
        ]
      };
    })
  );

  /**
   * Handler for reading resources.
   * Supports both static resources and resource templates.
   */
  server.setRequestHandler(
    ReadResourceRequestSchema,
    createLoggingHandler('ReadResource', async (request: any) => {
      const uri = request.params.uri;
      
      try {
        // Parse the URI to determine what resource is being requested
        const url = new URL(uri);
        
        if (url.protocol !== "mtender:") {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unsupported protocol: ${url.protocol}`
          );
        }
        
        // Handle different resource types based on the path
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        if (uri === "mtender://latest-tenders") {
          // Fetch the latest tenders
          const response = await axios.get(`${MTENDER_API_BASE_URL}/tenders/`);
          
          return {
            contents: [{
              uri: uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } else if (pathParts[0] === "tender" && pathParts[1]) {
          // Fetch a specific tender by OCID
          const ocid = pathParts[1];
          const response = await axios.get(`${MTENDER_API_BASE_URL}/tenders/${ocid}`);
          
          // Extract the tender title for a better description
          let title = "Tender Details";
          if (response.data.records && response.data.records[0].compiledRelease) {
            title = response.data.records[0].compiledRelease.tender.title || title;
          }
          
          return {
            contents: [{
              uri: uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2),
              name: title
            }]
          };
        } else if (pathParts[0] === "budget" && pathParts[1]) {
          // Fetch budget data by OCID
          const ocid = pathParts[1];
          const response = await axios.get(`${MTENDER_API_BASE_URL}/budgets/${ocid}/${ocid}`);
          
          return {
            contents: [{
              uri: uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } else if (pathParts[0] === "funding" && pathParts[1]) {
          // Fetch funding source data by OCID
          const ocid = pathParts[1];
          // Extract the funding source ID from the OCID
          const parts = ocid.split('-');
          const fundingSourceId = `${parts.slice(0, -1).join('-')}-FS-${parts[parts.length - 1]}`;
          
          const response = await axios.get(`${MTENDER_API_BASE_URL}/budgets/${ocid}/${fundingSourceId}`);
          
          return {
            contents: [{
              uri: uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } else {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid resource URI: ${uri}`
          );
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `MTender API error: ${error.message}`
          );
        }
        throw error;
      }
    })
  );
}