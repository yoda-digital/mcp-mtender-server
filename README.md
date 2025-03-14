# MTender MCP OCDS Server

An MCP (Model Context Protocol) server for accessing Moldova's public procurement data through the MTender API.

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue.svg)](https://github.com/yoda-digital/mcp-mtender-server)
[![Version](https://img.shields.io/badge/version-0.2.0-brightgreen.svg)](https://github.com/yoda-digital/mcp-mtender-server)
[![License](https://img.shields.io/badge/license-Custom-orange.svg)](https://github.com/yoda-digital/mcp-mtender-server/blob/main/LICENCE.md)
[![Node.js](https://img.shields.io/badge/Node.js-v20-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-v0.6.0-purple.svg)](https://github.com/anthropics/anthropic-sdk-typescript)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)](https://github.com/yoda-digital/mcp-mtender-server)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## Overview

This server provides access to the [MTender](https://public.mtender.gov.md/) public procurement system of Moldova, which implements the [Open Contracting Data Standard (OCDS)](https://standard.open-contracting.org/). It allows AI assistants to search for tenders, access tender details, budget information, funding sources, and analyze tender documents.

### Code Structure

The server is organized into a modular structure for better maintainability:

```
mtender-server/
├── src/
│   ├── index.ts                  # Main entry point
│   ├── api/
│   │   └── mtender-client.ts     # MTender API client with axios
│   ├── handlers/
│   │   ├── resources.ts          # Resource handlers
│   │   ├── tools.ts              # Tool handlers
│   │   └── utils.ts              # Shared handler utilities
│   └── utils/
│       └── logger.ts             # Logging utility
├── build/                        # Compiled JavaScript
├── logs/                         # Log files
├── Dockerfile                    # Docker configuration
├── docker-compose.yml           # Docker Compose configuration
└── .dockerignore                # Docker ignore file
```

This modular structure makes the code easier to maintain, understand, and extend.

### OCDS Schema Coverage

This MCP server provides comprehensive access to the MTender API, which implements the Open Contracting Data Standard. Here's the coverage of the OCDS schema:

| OCDS Component | Support Level | Notes |
|----------------|---------------|-------|
| **Release Packages** | ✅ Full | Supported through direct API access |
| **Records** | ✅ Full | Supported through direct API access |
| **Planning Section** | ✅ Full | Accessible through budget endpoints |
| **Tender Section** | ✅ Full | Core tender data fully supported |
| **Award Section** | ✅ Full | Included in tender responses |
| **Contract Section** | ✅ Full | Included in tender responses |
| **Implementation Section** | ⚠️ Partial | Limited by MTender API capabilities |
| **Organizations/Parties** | ✅ Full | Included in all responses |
| **Items** | ✅ Full | Included in tender, award, contract sections |
| **Values** | ✅ Full | Monetary values with currency information |
| **Periods** | ✅ Full | Date ranges for various process stages |
| **Documents** | ✅ Full | Document references and content extraction |
| **Milestones** | ✅ Full | Process milestones included in responses |
| **Transactions** | ⚠️ Partial | Limited by MTender API capabilities |
| **Amendments** | ✅ Full | Changes to processes are tracked |
| **Related Processes** | ✅ Full | Links between related contracting processes |

The server provides a complete interface to all data available through the MTender API, making it a full-featured OCDS client within the constraints of the underlying API.

> **Note on Partial Support**: The Implementation Section and Transactions are marked as partial because the MTender system in Moldova currently does not include data for the implementation stage of the contracting process. The MTender API only covers four stages: planning, tender, award, and contract, but does not include contract implementation data. This is a limitation of the underlying API, not of this MCP server.

## Features

### Resources

- **Latest Tenders**: Access the most recent tenders in the MTender system
- **Tender by OCID**: Access detailed tender data by Open Contracting ID (OCID)
- **Budget by OCID**: Access budget data by Open Contracting ID (OCID)
- **Funding Source by OCID**: Access funding source data by Open Contracting ID (OCID)

### Tools

- **search_tenders**: Search for tenders in the MTender system with pagination and filtering options
- **get_tender**: Get detailed information about a specific tender with format options
- **get_budget**: Get budget information for a specific tender with format options
- **get_funding_source**: Get funding source information for a specific tender with format options
- **analyze_tender**: Analyze a tender and extract key information according to OCDS schema
- **fetch_tender_document**: Fetch and analyze tender documents (PDF, DOC, DOCX) for AI/LLM analysis

## Installation

### From GitHub

You can clone the repository directly from GitHub:

```bash
git clone https://github.com/yoda-digital/mcp-mtender-server.git
cd mcp-mtender-server
npm install
npm run build
```

### Manual Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the server:
   ```
   npm run build
   ```
4. (Optional) Make the server globally available:
   ```
   npm link
   ```

## Docker Setup

The MTender OCDS Server can be run in a Docker container, which provides an isolated and consistent environment.

### Building the Docker Image

To build the Docker image:

```bash
cd mtender-server
docker build -t mtender-mcp-server .
```

### Running with Docker

To run the server using Docker:

```bash
docker run -v $(pwd)/logs:/app/logs mtender-mcp-server
```

This command mounts the local logs directory to the container's logs directory, ensuring that logs are persisted on the host machine.

### Using Docker Compose

For a more convenient setup, you can use Docker Compose:

```bash
cd mtender-server
docker-compose up -d
```

This will build the image if it doesn't exist and start the container in detached mode.

To stop the container:

```bash
docker-compose down
```

### Docker Configuration

The Docker setup includes:

- Multi-stage build for smaller image size
- Alpine-based Node.js image for minimal footprint
- Production-optimized dependencies
- Volume mounting for logs persistence
- Environment variable configuration

## Usage

### Running the Server

```bash
node build/index.js
```

Or if you've linked it globally:

```bash
mtender-server
```

### Testing

There are several ways to test the server:

#### Testing the MTender API Directly

The `simple-test.js` script tests the MTender API directly without using the MCP server:

```bash
node simple-test.js
```

This is useful for understanding the API structure and verifying that the API is accessible.

#### Testing the MCP Server

The `mcp-test.js` script demonstrates how to use the server programmatically:

```bash
node mcp-test.js
```

This script shows how to:
- Connect to the server
- List available resource templates and resources
- List available tools
- Search for tenders
- Get tender details
- Fetch and analyze tender documents

#### Interactive Testing with MCP Inspector

The MCP Inspector is a tool for testing MCP servers interactively:

```bash
npm run inspector
```

This will launch the MCP Inspector connected to this server, allowing you to test the resources and tools through a web interface.

### Integrating with MCP Clients

A configuration template file (`mcp-config-template.json`) is provided to help you integrate this server with MCP clients like Claude Desktop or VSCode with the Cline extension.

#### For Claude Desktop:

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (on macOS) or the equivalent path on your operating system.
2. Add the configuration from the template to the `mcpServers` object in the config file (replace `/path/to/mtender-server` with the actual path to your server).
3. Restart Claude Desktop.

#### For VSCode with Cline:

1. Edit `/home/user/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json` (just a refference example,example on Linux) or the equivalent path on your operating system.
2. Add the configuration from the template to the `mcpServers` object in the config file (replace `/path/to/mtender-server` with the actual path to your server).
3. Restart VSCode.

Once integrated, you can access MTender data through natural language queries in your MCP client.

## Development

### Adding New Features

The modular structure makes it easy to add new features:

1. For new resources, update the `handlers/resources.ts` file
2. For new tools, update the `handlers/tools.ts` file
3. For API client changes, modify the `api/mtender-client.ts` file
4. For logging improvements, update the `utils/logger.ts` file

### Contributing

Contributions to the MTender OCDS Server are welcome! You can contribute by:

1. Forking the [GitHub repository](https://github.com/yoda-digital/mcp-mtender-server)
2. Creating a feature branch
3. Making your changes
4. Submitting a pull request

### Logging

The server includes a comprehensive logging system that writes to files in the `logs/` directory. This is useful for debugging and monitoring the server's operation.

## Known Limitations

- **Resource Timeouts**: When accessing resources directly, you may encounter timeout issues due to the large amount of data being processed. This is especially true for the `mtender://latest-tenders` resource. The tools functionality (`search_tenders`, `get_tender`, etc.) works reliably and is the recommended way to access the data.

## Example Queries

Here are some example queries you can use with Claude once the server is connected:

- "Show me the latest tenders from MTender"
- "Get details for tender ocds-b3wdp1-MD-1613996912600"
- "Find budget information for ocds-b3wdp1-MD-1613996472664"
- "What is the funding source for tender ocds-b3wdp1-MD-1613996912600?"
- "Search for tenders from January 2023 to June 2023"
- "Show me a summary of tender ocds-b3wdp1-MD-1613996912600"
- "Analyze tender ocds-b3wdp1-MD-1613996912600 and focus on the awards and contracts sections"
- "Find tenders with a limit of 10 results"
- "Analyze the tender documents for ocds-b3wdp1-MD-1613996912600"

## API Reference

### Resource URIs

- `mtender://latest-tenders` - List of the most recent tenders
- `mtender://tender/{ocid}` - Tender details by OCID
- `mtender://budget/{ocid}` - Budget details by OCID
- `mtender://funding/{ocid}` - Funding source details by OCID

### Tool Parameters

#### search_tenders
- `offset` (optional): Pagination offset (ISO date string)
- `limit` (optional): Maximum number of results to return
- `dateFrom` (optional): Filter tenders from this date (ISO date string)
- `dateTo` (optional): Filter tenders until this date (ISO date string)

#### get_tender
- `ocid` (required): Open Contracting ID (OCID) of the tender
- `format` (optional): Response format: 'full' for complete data, 'summary' for key information

#### get_budget
- `ocid` (required): Open Contracting ID (OCID) of the budget
- `format` (optional): Response format: 'full' for complete data, 'summary' for key information

#### get_funding_source
- `ocid` (required): Open Contracting ID (OCID) of the tender
- `format` (optional): Response format: 'full' for complete data, 'summary' for key information

#### analyze_tender
- `ocid` (required): Open Contracting ID (OCID) of the tender
- `sections` (optional): OCDS sections to analyze (array of: "planning", "tender", "awards", "contracts", "implementation")

#### fetch_tender_document
- `documentUrl` (required): MTender storage URL of the document (must match pattern: ^https://storage\.mtender\.gov\.md/get/[\w-]+-\d+$)

## License

Copyright 2025 Ion Nalyk Calmis (Yoda.Digital)

All rights reserved.

Permission is granted to use and distribute this software for personal and non-commercial purposes only.
Modification, redistribution, and commercial use are strictly prohibited without explicit permission from the author.

For more details, see the [LICENCE.md](LICENCE.md) file.
