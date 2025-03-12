/**
 * Type declaration file for pdf-parse-wrapper.js
 */

declare const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string }>;

export default pdfParse;