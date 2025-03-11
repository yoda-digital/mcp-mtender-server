# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-03-11

### Added
- New `fetch_tender_document` tool for fetching and analyzing tender documents
- Support for PDF document extraction and analysis
- Support for DOC/DOCX document extraction and analysis
- Streaming download support for large files
- Text normalization for AI/LLM consumption
- Error handling for unsupported document types
- Content-type based document processing

### Dependencies
- Added `pdf-parse` for PDF document processing
- Added `mammoth` for DOC/DOCX document processing

## [0.1.0] - 2025-03-01

### Initial Release
- Basic MTender API integration
- OCDS data access and analysis
- Support for searching tenders
- Support for accessing tender details
- Support for accessing budget information
- Support for accessing funding sources
- Support for analyzing tender data according to OCDS schema