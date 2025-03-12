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