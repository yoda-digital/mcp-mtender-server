# Integration Plan for Fetch Tender Document Functionality

## Overview
This plan outlines the integration of `fetch_tender_document` functionality into the MTender MCP server. This tool will enable AI/LLM systems to analyze the actual tender documents (PDFs, DOCs) alongside the structured OCDS data they already access through existing tools.

## Implementation Steps

### 1. Add Tool Definition
Update `src/handlers/tools.ts` to include the new tool:

```typescript
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
```

### 2. Implement Document Processing
Add document handling logic in `src/handlers/tools.ts`:

```typescript
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
        ErrorCode.ExternalServiceError,
        `Failed to fetch document: ${error.message}`
      );
    }
    throw error;
  }
}
```

### 3. Add Helper Function
Add to `src/handlers/utils.ts`:

```typescript
export async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
```

### 4. Dependencies
Add to package.json:

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0"
  }
}
```

## Testing

Test the integration with these scenarios:

1. PDF document in Romanian
2. DOCX document in Russian
3. Large file (>10MB)
4. Invalid URL format
5. Network error handling
6. Unsupported file type

## Example Usage

The tool will enable AI/LLM queries like:

```text
"Analyze the tender documents for ocds-b3wdp1-MD-1613996912600 and tell me about the technical requirements"
```

The AI can then use both:
- Structured OCDS data (via existing tools)
- Actual document content (via new fetch_tender_document)

## Next Steps

1. Implement the changes
2. Add unit tests
3. Test with actual MTender documents
