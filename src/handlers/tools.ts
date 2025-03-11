import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { axiosInstance, MTENDER_API_BASE_URL } from "../api/mtender-client.js";
import { createLoggingHandler, streamToBuffer } from "./utils.js";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

/**
 * Setup tool handlers for the MCP server
 */
export function setupToolHandlers(server: any) {
  /**
   * Handler that lists available tools.
   * Exposes tools for searching tenders and getting tender details.
   */
  server.setRequestHandler(
    ListToolsRequestSchema,
    createLoggingHandler('ListTools', async () => {
      return {
        tools: [
          {
            name: "search_tenders",
            description: "Search for tenders in the MTender system with pagination and filtering options",
            inputSchema: {
              type: "object",
              properties: {
                offset: {
                  type: "string",
                  description: "Pagination offset (ISO date string)"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return"
                },
                dateFrom: {
                  type: "string",
                  description: "Filter tenders from this date (ISO date string)"
                },
                dateTo: {
                  type: "string",
                  description: "Filter tenders until this date (ISO date string)"
                }
              }
            }
          },
          {
            name: "get_tender",
            description: "Get detailed information about a specific tender",
            inputSchema: {
              type: "object",
              properties: {
                ocid: {
                  type: "string",
                  description: "Open Contracting ID (OCID) of the tender"
                },
                format: {
                  type: "string",
                  description: "Response format: 'full' for complete data, 'summary' for key information",
                  enum: ["full", "summary"]
                }
              },
              required: ["ocid"]
            }
          },
          {
            name: "get_budget",
            description: "Get budget information for a specific tender",
            inputSchema: {
              type: "object",
              properties: {
                ocid: {
                  type: "string",
                  description: "Open Contracting ID (OCID) of the budget"
                },
                format: {
                  type: "string",
                  description: "Response format: 'full' for complete data, 'summary' for key information",
                  enum: ["full", "summary"]
                }
              },
              required: ["ocid"]
            }
          },
          {
            name: "get_funding_source",
            description: "Get funding source information for a specific tender",
            inputSchema: {
              type: "object",
              properties: {
                ocid: {
                  type: "string",
                  description: "Open Contracting ID (OCID) of the tender"
                },
                format: {
                  type: "string",
                  description: "Response format: 'full' for complete data, 'summary' for key information",
                  enum: ["full", "summary"]
                }
              },
              required: ["ocid"]
            }
          },
          {
            name: "analyze_tender",
            description: "Analyze a tender and extract key information according to OCDS schema",
            inputSchema: {
              type: "object",
              properties: {
                ocid: {
                  type: "string",
                  description: "Open Contracting ID (OCID) of the tender"
                },
                sections: {
                  type: "array",
                  description: "OCDS sections to analyze (leave empty for all sections)",
                  items: {
                    type: "string",
                    enum: ["planning", "tender", "awards", "contracts", "implementation"]
                  }
                }
              },
              required: ["ocid"]
            }
          },
          {
            name: "fetch_tender_document",
            description: "Fetch and extract text from tender documents for AI/LLM analysis",
            inputSchema: {
              type: "object",
              properties: {
                documentUrl: {
                  type: "string",
                  description: "MTender storage URL of the document",
                  pattern: "^https://storage\\.mtender\\.gov\\.md/get/[\\w-]+-\\d+$"
                }
              },
              required: ["documentUrl"]
            }
          }
        ]
      };
    })
  );

  /**
   * Handler for tool calls.
   * Implements the search_tenders, get_tender, get_budget, and get_funding_source tools.
   */
  server.setRequestHandler(
    CallToolRequestSchema,
    createLoggingHandler('CallTool', async (request: any) => {
      try {
        switch (request.params.name) {
          case "search_tenders": {
            const offset = request.params.arguments?.offset as string | undefined;
            const limit = Number(request.params.arguments?.limit) || 100;
            const dateFrom = request.params.arguments?.dateFrom as string | undefined;
            const dateTo = request.params.arguments?.dateTo as string | undefined;
            
            let url = `${MTENDER_API_BASE_URL}/tenders/`;
            const params = new URLSearchParams();
            
            if (offset) {
              params.append('offset', offset);
            }
            
            // Note: The actual MTender API might not support these filters directly,
            // so we're implementing client-side filtering in this case
            const response = await axios.get(url + (params.toString() ? `?${params.toString()}` : ''));
            
            let filteredData = [...response.data.data];
            
            // Apply date filters if provided
            if (dateFrom || dateTo) {
              filteredData = filteredData.filter(item => {
                const itemDate = new Date(item.date);
                if (dateFrom && new Date(dateFrom) > itemDate) return false;
                if (dateTo && new Date(dateTo) < itemDate) return false;
                return true;
              });
            }
            
            // Limit the number of results if requested
            if (limit && filteredData.length > limit) {
              filteredData = filteredData.slice(0, Number(limit));
            }
            
            // Create a modified response with the filtered data
            const filteredResponse = {
              ...response.data,
              data: filteredData,
              meta: {
                originalCount: response.data.data.length,
                filteredCount: filteredData.length,
                filters: {
                  dateFrom: dateFrom || null,
                  dateTo: dateTo || null,
                  offset: offset || null,
                  limit: limit || null
                }
              }
            };
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(filteredResponse, null, 2)
              }]
            };
          }
          
          case "get_tender": {
            const ocid = String(request.params.arguments?.ocid);
            if (!ocid) {
              throw new Error("OCID is required");
            }
            
            const format = String(request.params.arguments?.format || 'full');
            const response = await axios.get(`${MTENDER_API_BASE_URL}/tenders/${ocid}`);
            
            if (format === 'summary') {
              // Extract key information for a more readable response
              let summary = "Tender Summary:\n\n";
              if (response.data.records && response.data.records.length > 0) {
                const record = response.data.records[0].compiledRelease;
                if (record && record.tender) {
                  const tender = record.tender;
                  summary += `Tender ID: ${tender.id}\n` +
                            `Title: ${tender.title}\n` +
                            `Description: ${tender.description || 'N/A'}\n` +
                            `Status: ${tender.status}\n` +
                            `Value: ${tender.value?.amount || 'N/A'} ${tender.value?.currency || ''}\n` +
                            `Procurement Method: ${tender.procurementMethod || 'N/A'}\n` +
                            `Category: ${tender.mainProcurementCategory || 'N/A'}\n`;
                  
                  // Add buyer information
                  if (record.buyer) {
                    summary += `\nBuyer: ${record.buyer.name || 'N/A'}\n`;
                  }
                  
                  // Add award information if available
                  if (record.awards && record.awards.length > 0) {
                    summary += `\nAward Information:\n`;
                    record.awards.forEach((award: any, index: number) => {
                      summary += `Award ${index + 1}:\n` +
                                `  Status: ${award.status || 'N/A'}\n` +
                                `  Value: ${award.value?.amount || 'N/A'} ${award.value?.currency || ''}\n`;
                      if (award.suppliers && award.suppliers.length > 0) {
                        summary += `  Suppliers: ${award.suppliers.map((s: any) => s.name).join(', ')}\n`;
                      }
                    });
                  }
                  
                  // Add contract information if available
                  if (record.contracts && record.contracts.length > 0) {
                    summary += `\nContract Information:\n`;
                    record.contracts.forEach((contract: any, index: number) => {
                      summary += `Contract ${index + 1}:\n` +
                                `  Status: ${contract.status || 'N/A'}\n` +
                                `  Value: ${contract.value?.amount || 'N/A'} ${contract.value?.currency || ''}\n` +
                                `  Period: ${contract.period?.startDate || 'N/A'} to ${contract.period?.endDate || 'N/A'}\n`;
                    });
                  }
                }
              }
              
              return {
                content: [{ type: "text", text: summary }]
              };
            } else {
              // Return full data
              return {
                content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
              };
            }
          }
          
          case "get_budget": {
            const ocid = String(request.params.arguments?.ocid);
            if (!ocid) {
              throw new Error("OCID is required");
            }
            
            const format = String(request.params.arguments?.format || 'full');
            const response = await axios.get(`${MTENDER_API_BASE_URL}/budgets/${ocid}/${ocid}`);
            
            if (format === 'summary') {
              // Extract key budget information
              let summary = "Budget Summary:\n\n";
              if (response.data.releases && response.data.releases.length > 0) {
                const release = response.data.releases[0];
                if (release.planning && release.planning.budget) {
                  const budget = release.planning.budget;
                  summary += `Budget ID: ${budget.id || 'N/A'}\n` +
                            `Description: ${budget.description || 'N/A'}\n`;
                  
                  if (budget.amount) {
                    summary += `Amount: ${budget.amount.amount || 'N/A'} ${budget.amount.currency || ''}\n`;
                  }
                  
                  if (budget.project) {
                    summary += `Project: ${budget.project}\n`;
                    if (budget.projectID) {
                      summary += `Project ID: ${budget.projectID}\n`;
                    }
                  }
                  
                  // Add period information if available
                  if (budget.period) {
                    summary += `Period: ${budget.period.startDate || 'N/A'} to ${budget.period.endDate || 'N/A'}\n`;
                  }
                }
              }
              
              return {
                content: [{ type: "text", text: summary }]
              };
            } else {
              // Return full data
              return {
                content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
              };
            }
          }
          
          case "get_funding_source": {
            const ocid = String(request.params.arguments?.ocid);
            if (!ocid) {
              throw new Error("OCID is required");
            }
            
            const format = String(request.params.arguments?.format || 'full');
            
            // Extract the funding source ID from the OCID
            const parts = ocid.split('-');
            const fundingSourceId = `${parts.slice(0, -1).join('-')}-FS-${parts[parts.length - 1]}`;
            
            const response = await axios.get(`${MTENDER_API_BASE_URL}/budgets/${ocid}/${fundingSourceId}`);
            
            if (format === 'summary') {
              // Extract key funding source information
              let summary = "Funding Source Summary:\n\n";
              if (response.data.releases && response.data.releases.length > 0) {
                const release = response.data.releases[0];
                
                // Basic information
                summary += `Funding Source ID: ${fundingSourceId}\n`;
                summary += `Related Tender: ${ocid}\n\n`;
                
                // Planning information
                if (release.planning) {
                  summary += "Planning Information:\n";
                  
                  if (release.planning.budget) {
                    const budget = release.planning.budget;
                    
                    if (budget.amount) {
                      summary += `Amount: ${budget.amount.amount || 'N/A'} ${budget.amount.currency || ''}\n`;
                    }
                    
                    if (budget.description) {
                      summary += `Description: ${budget.description}\n`;
                    }
                    
                    // Add period information if available
                    if (budget.period) {
                      summary += `Period: ${budget.period.startDate || 'N/A'} to ${budget.period.endDate || 'N/A'}\n`;
                    }
                  }
                }
                
                // Parties information
                if (release.parties && release.parties.length > 0) {
                  summary += "\nParties Involved:\n";
                  release.parties.forEach((party: any, index: number) => {
                    summary += `${index + 1}. ${party.name || 'Unnamed'} (${party.roles?.join(', ') || 'No roles specified'})\n`;
                  });
                }
              }
              
              return {
                content: [{ type: "text", text: summary }]
              };
            } else {
              // Return full data
              return {
                content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
              };
            }
          }
          
          case "analyze_tender": {
            const ocid = String(request.params.arguments?.ocid);
            if (!ocid) {
              throw new Error("OCID is required");
            }
            
            const sections = request.params.arguments?.sections as string[] || ["planning", "tender", "awards", "contracts", "implementation"];
            
            const response = await axios.get(`${MTENDER_API_BASE_URL}/tenders/${ocid}`);
            
            let analysis = `# OCDS Analysis for ${ocid}\n\n`;
            
            if (response.data.records && response.data.records.length > 0) {
              const record = response.data.records[0].compiledRelease;
              
              // Analyze each requested section
              for (const section of sections) {
                switch (section) {
                  case "planning":
                    analysis += "## Planning Section\n\n";
                    if (record.planning) {
                      analysis += "Planning information is available.\n\n";
                      
                      if (record.planning.budget) {
                        const budget = record.planning.budget;
                        analysis += "### Budget\n";
                        analysis += `- Budget ID: ${budget.id || 'Not specified'}\n`;
                        analysis += `- Description: ${budget.description || 'Not provided'}\n`;
                        
                        if (budget.amount) {
                          analysis += `- Amount: ${budget.amount.amount || 'N/A'} ${budget.amount.currency || ''}\n`;
                        }
                        
                        if (budget.project) {
                          analysis += `- Project: ${budget.project}\n`;
                          if (budget.projectID) {
                            analysis += `- Project ID: ${budget.projectID}\n`;
                          }
                        }
                        
                        analysis += "\n";
                      } else {
                        analysis += "No budget information available.\n\n";
                      }
                      
                      if (record.planning.documents && record.planning.documents.length > 0) {
                        analysis += "### Planning Documents\n";
                        record.planning.documents.forEach((doc: any, index: number) => {
                          analysis += `- Document ${index + 1}: ${doc.title || 'Untitled'} (${doc.documentType || 'Unspecified type'})\n`;
                        });
                        analysis += "\n";
                      }
                    } else {
                      analysis += "No planning information available.\n\n";
                    }
                    break;
                    
                  case "tender":
                    analysis += "## Tender Section\n\n";
                    if (record.tender) {
                      const tender = record.tender;
                      analysis += `- ID: ${tender.id || 'Not specified'}\n`;
                      analysis += `- Title: ${tender.title || 'Not specified'}\n`;
                      analysis += `- Description: ${tender.description || 'Not provided'}\n`;
                      analysis += `- Status: ${tender.status || 'Not specified'}\n`;
                      
                      if (tender.value) {
                        analysis += `- Value: ${tender.value.amount || 'N/A'} ${tender.value.currency || ''}\n`;
                      }
                      
                      analysis += `- Procurement Method: ${tender.procurementMethod || 'Not specified'}\n`;
                      analysis += `- Procurement Category: ${tender.mainProcurementCategory || 'Not specified'}\n\n`;
                      
                      if (tender.items && tender.items.length > 0) {
                        analysis += "### Items\n";
                        analysis += `${tender.items.length} item(s) specified in the tender.\n\n`;
                      }
                      
                      if (tender.documents && tender.documents.length > 0) {
                        analysis += "### Tender Documents\n";
                        analysis += `${tender.documents.length} document(s) attached to the tender.\n\n`;
                      }
                    } else {
                      analysis += "No tender information available.\n\n";
                    }
                    break;
                    
                  case "awards":
                    analysis += "## Awards Section\n\n";
                    if (record.awards && record.awards.length > 0) {
                      analysis += `${record.awards.length} award(s) found.\n\n`;
                      
                      record.awards.forEach((award: any, index: number) => {
                        analysis += `### Award ${index + 1}\n`;
                        analysis += `- ID: ${award.id || 'Not specified'}\n`;
                        analysis += `- Status: ${award.status || 'Not specified'}\n`;
                        
                        if (award.value) {
                          analysis += `- Value: ${award.value.amount || 'N/A'} ${award.value.currency || ''}\n`;
                        }
                        
                        if (award.suppliers && award.suppliers.length > 0) {
                          analysis += `- Suppliers: ${award.suppliers.map((s: any) => s.name).join(', ')}\n`;
                        }
                        
                        analysis += "\n";
                      });
                    } else {
                      analysis += "No award information available.\n\n";
                    }
                    break;
                    
                  case "contracts":
                    analysis += "## Contracts Section\n\n";
                    if (record.contracts && record.contracts.length > 0) {
                      analysis += `${record.contracts.length} contract(s) found.\n\n`;
                      
                      record.contracts.forEach((contract: any, index: number) => {
                        analysis += `### Contract ${index + 1}\n`;
                        analysis += `- ID: ${contract.id || 'Not specified'}\n`;
                        analysis += `- Status: ${contract.status || 'Not specified'}\n`;
                        
                        if (contract.value) {
                          analysis += `- Value: ${contract.value.amount || 'N/A'} ${contract.value.currency || ''}\n`;
                        }
                        
                        if (contract.period) {
                          analysis += `- Period: ${contract.period.startDate || 'N/A'} to ${contract.period.endDate || 'N/A'}\n`;
                        }
                        
                        if (contract.dateSigned) {
                          analysis += `- Date Signed: ${contract.dateSigned}\n`;
                        }
                        
                        analysis += "\n";
                      });
                    } else {
                      analysis += "No contract information available.\n\n";
                    }
                    break;
                    
                  case "implementation":
                    analysis += "## Implementation Section\n\n";
                    let implementationFound = false;
                    
                    if (record.contracts) {
                      for (const contract of record.contracts) {
                        if (contract.implementation) {
                          implementationFound = true;
                          analysis += `### Implementation for Contract ${contract.id || 'Unknown'}\n\n`;
                          
                          if (contract.implementation.transactions && contract.implementation.transactions.length > 0) {
                            analysis += "#### Transactions\n";
                            analysis += `${contract.implementation.transactions.length} transaction(s) recorded.\n\n`;
                            
                            contract.implementation.transactions.forEach((transaction: any, index: number) => {
                              analysis += `- Transaction ${index + 1}: `;
                              if (transaction.value) {
                                analysis += `${transaction.value.amount || 'N/A'} ${transaction.value.currency || ''} `;
                              }
                              if (transaction.date) {
                                analysis += `on ${transaction.date}`;
                              }
                              analysis += "\n";
                            });
                            
                            analysis += "\n";
                          }
                          
                          if (contract.implementation.milestones && contract.implementation.milestones.length > 0) {
                            analysis += "#### Milestones\n";
                            analysis += `${contract.implementation.milestones.length} milestone(s) recorded.\n\n`;
                          }
                          
                          if (contract.implementation.documents && contract.implementation.documents.length > 0) {
                            analysis += "#### Implementation Documents\n";
                            analysis += `${contract.implementation.documents.length} document(s) attached to implementation.\n\n`;
                          }
                        }
                      }
                    }
                    
                    if (!implementationFound) {
                      analysis += "No implementation information available.\n\n";
                    }
                    break;
                }
              }
              
              // Add OCDS compliance summary
              analysis += "## OCDS Compliance Summary\n\n";
              analysis += "### Required Sections\n";
              analysis += `- Tender: ${record.tender ? '✅ Present' : '❌ Missing'}\n`;
              
              // Optional but recommended sections
              analysis += "\n### Optional Sections\n";
              analysis += `- Planning: ${record.planning ? '✅ Present' : '⚠️ Not provided'}\n`;
              analysis += `- Awards: ${record.awards && record.awards.length > 0 ? '✅ Present' : '⚠️ Not provided'}\n`;
              analysis += `- Contracts: ${record.contracts && record.contracts.length > 0 ? '✅ Present' : '⚠️ Not provided'}\n`;
              analysis += `- Implementation: ${record.contracts && record.contracts.some((c: any) => c.implementation) ? '✅ Present' : '⚠️ Not provided'}\n`;
              
              // Parties information
              analysis += "\n### Parties Information\n";
              if (record.parties && record.parties.length > 0) {
                analysis += `✅ ${record.parties.length} party/parties defined\n`;
                
                // Check for key roles
                const roles = new Set<string>();
                record.parties.forEach((party: any) => {
                  if (party.roles) {
                    party.roles.forEach((role: string) => roles.add(role));
                  }
                });
                
                analysis += "Roles present: " + Array.from(roles).join(', ') + "\n";
              } else {
                analysis += "❌ No parties defined\n";
              }
            } else {
              analysis = `No OCDS record found for ${ocid}`;
            }
            
            return {
              content: [{ type: "text", text: analysis }]
            };
          }
          
          case "fetch_tender_document": {
            const documentUrl = String(request.params.arguments?.documentUrl);
            
            // Validate URL format
            if (!documentUrl.startsWith("https://storage.mtender.gov.md/get/")) {
              throw new McpError(ErrorCode.InvalidParams, "Invalid MTender storage URL");
            }

            try {
              // Stream download to handle large files
              const response = await axios({
                method: 'get',
                url: documentUrl,
                responseType: 'stream'
              });

              // Get document info from headers
              const contentType = response.headers['content-type'];
              const disposition = response.headers['content-disposition'];
              const filename = disposition?.split('filename*=utf-8\'\'')[1] ||
                              disposition?.split('filename=')[1]?.replace(/"/g, '');

              // Process based on content type
              let textContent;
              if (contentType === 'application/pdf') {
                const pdfData = await streamToBuffer(response.data);
                const pdf = await pdfParse(pdfData);
                textContent = pdf.text;
              } else if (contentType.includes('msword') ||
                         contentType.includes('openxmlformats-officedocument')) {
                const docData = await streamToBuffer(response.data);
                const result = await mammoth.extractRawText({ buffer: docData });
                textContent = result.value;
              } else {
                throw new McpError(
                  ErrorCode.InvalidRequest,
                  `Unsupported document type: ${contentType}`
                );
              }

              // Clean and normalize text for AI/LLM consumption
              const cleanedText = textContent
                .replace(/\r\n/g, '\n')           // Normalize line endings
                .replace(/\n{3,}/g, '\n\n')       // Remove excess whitespace
                .trim();

              return {
                content: [{
                  type: "text",
                  text: cleanedText,
                  metadata: {
                    filename,
                    contentType,
                    source: documentUrl
                  }
                }]
              };
            } catch (error) {
              if (axios.isAxiosError(error)) {
                throw new McpError(
                  ErrorCode.InternalError,
                  `Failed to fetch document: ${error.message}`
                );
              }
              throw error;
            }
          }
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [{
              type: "text",
              text: `MTender API error: ${error.message}`
            }],
            isError: true
          };
        }
        throw error;
      }
    })
  );
}