# META VIEW — Image Metadata Studio

A Next.js application for inspecting, editing and enriching image metadata.

## Features
- Image upload and metadata inspection powered by ExifTool.
- Editable metadata fields and custom fields in the UI.
- AI image descriptions, alt text, scene, objects, dominant colours and tags using Gemini.
- Keyword editing, JSON report export and image metadata export.
- Batch metadata inspection (up to 25 images per selection).
- GPS coordinate editing through the metadata field editor, with a map link when coordinates are present.
- Selective metadata stripping on export.
- Metadata templates saved in browser local storage.
- Undo/redo for metadata field edits and a before/after field comparison.
- Light/dark theme and responsive workspace.
- No image gallery or permanent image storage. Images are uploaded to the app server for metadata extraction/export; temporary files are deleted after processing. The GPS map preview loads OpenStreetMap with the entered coordinates.

## Run locally or in Replit
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add your Gemini API key to `.env.local` to enable AI analysis.
5. Run `npm run dev`.
6. Open the local preview URL.

## Format compatibility notes
ExifTool supports a broad set of image containers, but writable tag families vary by format and by the exact file encoding. JPEG and TIFF generally offer the broadest EXIF/IPTC/XMP support; PNG and WebP use different metadata chunks and may not preserve every EXIF/IPTC field; HEIC/HEIF and camera RAW support depends on the ExifTool build and source variant. The UI therefore reports format-specific caution text and the export endpoint returns ExifTool errors rather than claiming every field was written. Always re-open the exported file to verify its tags.

## Important implementation notes
- ExifTool is used server-side for broad metadata read/write support.
- Metadata writing is allowlisted in `app/api/write/route.ts`; standard EXIF/IPTC tags and selected XMP namespaces are accepted. Test each format/tag family before production. Metadata stripping uses ExifTool's `-all=` operation.
- Actual metadata support depends on the image format and tag namespace. Some formats do not support EXIF/IPTC/XMP equivalently.
- AI results are suggestions and are kept distinct in the interface from extracted metadata.
- The server receives the image during inspection/export. Metadata routes use a temporary directory that is removed after each request; the AI route processes image bytes in memory. It does not save an image library. For production, add request limits, authentication/rate limits and stricter MIME validation.
- Batch inspection currently reports metadata counts; it does not yet perform batch writes. Templates are browser-local. Undo/redo covers metadata fields and keyword tags; it does not undo file replacement, downloads, or template deletion. GPS editing uses raw ExifTool coordinate fields rather than a graphical pin editor. This starter is a functional foundation, not a forensic-grade chain-of-custody tool. ExifTool warnings should be surfaced before production release.

## v3 additions
- Decimal GPS latitude/longitude/altitude editor with an OpenStreetMap preview iframe and range validation.
- Undo/redo snapshots include both metadata fields and keyword tags.
- Export validation re-opens the written file with ExifTool and reports how many requested tags can be found.
- AI title and description map to XMP Dublin Core; AI alt text maps to IPTC Core; AI scene/mood/colour/object terms are included as searchable subjects/keywords.
- User-defined custom fields are serialized as JSON into the EXIF UserComment field so they survive export as a portable payload.
- Format-specific compatibility cautions and basic validation for GPS coordinates and 0–5 ratings.

## Verification status
Source files passed TypeScript transpilation and a static TypeScript check using local ambient stubs. A full Next.js production build and live image round-trip test could not be run in this environment because npm registry access failed with a DNS/network resolution error (`EAI_AGAIN`). Run `npm install` and `npm run build` in Replit or another environment with registry access, then test exported files with a second metadata reader. Do not treat static checks as a production build.

## Privacy notes
Image uploads are sent to the app server for metadata extraction and export; temporary working directories are removed after each request. Gemini analysis sends the image to Google's Gemini API when the user explicitly clicks Generate. The map preview sends the entered coordinates to OpenStreetMap to display map tiles. Do not use this preview for sensitive coordinates if external map requests are not acceptable.
