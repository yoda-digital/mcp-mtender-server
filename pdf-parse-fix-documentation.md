# PDF Parse Module Fix Documentation

## Problem

The MTender MCP OCDS Server was encountering an error when importing the pdf-parse module:

```
Error: ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'
```

This error occurred because the pdf-parse module was trying to run test code during initialization. The module checks `module.parent` to determine if it's being imported or run directly:

```javascript
let isDebugMode = !module.parent; 

//for testing purpose
if (isDebugMode) {
    let PDF_FILE = './test/data/05-versions-space.pdf';
    let dataBuffer = Fs.readFileSync(PDF_FILE);
    // ...
}
```

In an ES modules context (as used in this project with `"type": "module"` in package.json), the `module.parent` check doesn't work as expected, causing the test code to run even when the module is being imported.

## Solution

We implemented a wrapper module that safely imports the pdf-parse module using the CommonJS require function, which prevents the test code from running:

1. Created a TypeScript wrapper module (`src/utils/pdf-parse-wrapper.ts`):
   ```typescript
   /**
    * A wrapper for the pdf-parse module that prevents it from running test code during initialization.
    * This solves the issue with ES modules vs CommonJS modules and the module.parent check.
    */

   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);

   // Import pdf-parse using require instead of ES import
   const pdfParse = require('pdf-parse');

   // Export as default for ES modules
   export default pdfParse;
   ```

2. Created a TypeScript declaration file (`src/utils/pdf-parse-wrapper.d.ts`):
   ```typescript
   /**
    * Type declaration file for pdf-parse-wrapper.js
    */

   declare const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string }>;

   export default pdfParse;
   ```

3. Updated the import in `src/handlers/tools.ts`:
   ```typescript
   import pdfParse from "../utils/pdf-parse-wrapper.js";
   ```

## Why This Works

The solution works because:

1. Using `createRequire` from the Node.js `module` package allows us to use CommonJS-style require in an ES modules context.
2. When importing the pdf-parse module with require, the `module.parent` check works correctly, preventing the test code from running.
3. The TypeScript declaration file ensures type safety when using the wrapper module.

## Testing

The solution was tested by:

1. Building the project with `npm run build`
2. Running the test scripts:
   - `node mcp-test.js` - Tests the MCP server functionality
   - `node simple-test.js` - Tests the MTender API directly

Both tests completed successfully, confirming that the issue is fixed.

## Future Maintenance

If you need to update the pdf-parse module in the future:

1. Update the version in package.json
2. Run `npm install` to install the new version
3. Test the application to ensure the wrapper still works correctly

If you encounter similar issues with other CommonJS modules in this ES modules project, you can use the same approach:

1. Create a wrapper module using `createRequire`
2. Create a TypeScript declaration file if needed
3. Update imports to use the wrapper module