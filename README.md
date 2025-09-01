# QR Local - URL Shortener for Local Networks

QR Local is a Node.js application designed to create short, QR code-friendly URLs for local network access at the `qr.local` domain. It uses base32 encoding to ensure QR codes can utilize alphanumeric mode for optimal space efficiency.

## Features

- **Base32 URL shortening** optimized for QR codes
- **QR Code Generation** with configurable error correction, version, and encoding
- **Visual QR codes** displayed in browse interface with click-to-download
- **Multiple download formats** (PNG and SVG)
- **Configurable ID length** to control QR code versions
- **SQLite database** for persistent storage
- **Visit tracking** with statistics
- **Custom keys** for predictable short URLs
- **RESTful API** for programmatic access
- **Web interface** for human-friendly management
- **Delete functionality** with confirmation

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node index.js [base32_length] [options]
   ```

### Configuration Options

**Command Line Arguments:**
- `base32_length` - Maximum length for base32 IDs (1-20, default: 6)

**QR Code Options:**
- `-e, --qr-error <L|M|Q|H>` - Error correction level (default: M)
- `-v, --qr-version <1-40>` - QR code version (default: 1)  
- `-m, --qr-mode <mode>` - Encoding mode: numeric, alphanumeric, byte (default: alphanumeric)
- `-d, --qr-domain <domain>` - Domain for QR code URLs (default: qr.local)
- `-h, --help` - Show help message

**Usage Examples:**
```bash
# Default settings (6 chars, Version 1, M error correction, alphanumeric, qr.local domain)
node index.js

# Custom base32 length with default QR settings
node index.js 10

# Custom domain for QR codes (server still runs on default port 80)
node index.js 6 -d mysite.com

# Custom domain with port in QR codes (port is just URL prefix, not server port)
node index.js 6 -d mysite.com:8080

# Server on custom port with matching domain configuration
PORT=8080 node index.js 6 -d mysite.com:8080

# High error correction with Version 2 and custom domain
node index.js 14 -e H -v 2 -d short.ly

# Full custom configuration
PORT=3000 node index.js 8 -m byte -e L -d example.org:3000
```

### QR Code Domain Configuration

**Important:** The `--qr-domain` option only affects the URLs embedded in generated QR codes. It does not change how the server operates or what port it binds to.

- **QR Domain**: Controls the URL prefix in QR codes (e.g., `mysite.com/abc123`)
- **Server Port**: Set via `PORT` environment variable (default: 80)
- **Server Function**: Operates independently of QR domain setting

**Examples:**
- QR codes contain `mysite.com:8080/abc123` but server runs on port 3000: `PORT=3000 node index.js -d mysite.com:8080`
- QR codes contain `qr.local/abc123` but server runs on port 8080: `PORT=8080 node index.js`

**Note:** QR code capacity varies by version and error correction level. The domain prefix length affects available space for base32 IDs.

## API Documentation

### Base URL
All API endpoints are prefixed with your server's base URL:
```
http://qr.local/api/
```

*Note: For development/testing, you can use `http://localhost:3000/api/`*

### Authentication
Currently, no authentication is required for API access.

---

## API Endpoints

### 1. Add Redirect

Create a new URL redirect with optional custom key.

**Endpoint:** `POST /api/add`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "url": "https://example.com",
  "key": "MYKEY23" // Optional custom key
}
```

**Success Response (201):**
```json
{
  "success": true,
  "qr_url": "qr.local/abc123d",
  "base32_id": "abc123d",
  "original_url": "https://example.com"
}
```

**Error Responses:**
- `400` - Missing or invalid URL
- `400` - Invalid custom key format
- `409` - Custom key already exists
- `500` - Database error

**cURL Example:**
```bash
# Auto-generate key
curl -X POST http://qr.local/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Use custom key
curl -X POST http://qr.local/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "key": "GITHUB"}'
```

**Custom Key Requirements:**
- 1 to `max_base32_length` characters
- Base32 characters only: A-Z, 2-7 (case insensitive)
- Must be unique across all redirects

---

### 2. Check URL Exists

Check if a URL already has a redirect and return its details.

**Endpoint:** `GET /api/check`

**Query Parameters:**
- `url` (required) - The URL to check

**Success Response (200) - URL Found:**
```json
{
  "exists": true,
  "qr_url": "qr.local/abc123d",
  "base32_id": "abc123d",
  "original_url": "https://example.com",
  "created": "2023-12-01T10:30:00.000Z",
  "visits": 5,
  "last_visit": "2023-12-01T15:45:00.000Z"
}
```

**Success Response (200) - URL Not Found:**
```json
{
  "exists": false,
  "message": "No redirect found for this URL"
}
```

**Error Responses:**
- `400` - Missing or invalid URL parameter
- `500` - Database error

**cURL Example:**
```bash
curl "http://qr.local/api/check?url=https://example.com"
```

---

### 3. Delete Redirect

Delete an existing redirect by its base32 ID.

**Endpoint:** `DELETE /api/delete/:id`

**URL Parameters:**
- `id` (required) - The base32 ID of the redirect to delete

**Success Response (200):**
```json
{
  "success": true,
  "message": "Redirect deleted successfully",
  "deleted_id": "abc123d",
  "deleted_url": "https://example.com"
}
```

**Error Responses:**
- `404` - Redirect not found
- `500` - Database error

**cURL Example:**
```bash
curl -X DELETE http://qr.local/api/delete/abc123d
```

---

### 4. Access Redirect

Follow a redirect to its destination URL.

**Endpoint:** `GET /:base32id`

**URL Parameters:**
- `base32id` - The base32 ID of the redirect

**Success Response:** HTTP 302 redirect to destination URL

**Error Response:** 
- `404` - Redirect not found

**Browser Example:**
```
http://qr.local/abc123d
```

**Note:** This endpoint automatically increments the visit counter and updates the last visit timestamp.

---

### 5. Get QR Code Image

Display a QR code image for a redirect.

**Endpoint:** `GET /qr/:id/png`

**URL Parameters:**
- `id` - The base32 ID of the redirect

**Success Response:** PNG image of QR code

**Error Response:** 
- `404` - Redirect not found
- `500` - QR generation error

**Browser Example:**
```
http://qr.local/qr/abc123d/png
```

**Note:** This endpoint returns the QR code as a PNG image for inline display. Images are cached for 24 hours.

---

### 6. Download QR Code

Download a QR code file for a redirect.

**Endpoints:** 
- `GET /download/qr/:id/png` - Download PNG format
- `GET /download/qr/:id/svg` - Download SVG format

**URL Parameters:**
- `id` - The base32 ID of the redirect

**Success Response:** File download with appropriate Content-Disposition headers

**Error Response:** 
- `404` - Redirect not found
- `500` - QR generation error

**Browser Examples:**
```
http://qr.local/download/qr/abc123d/png
http://qr.local/download/qr/abc123d/svg
```

**Note:** These endpoints trigger file downloads with filenames like `qr-abc123d.png` or `qr-abc123d.svg`.

---

## Web Interface

The application provides a user-friendly web interface:

### Human-Readable URLs

- **Add Redirect:** `http://qr.local/human/add`
  - Form to create new redirects with optional custom keys
  - Real-time validation and feedback

- **Browse Redirects:** `http://qr.local/human/browse`  
  - Table view of all redirects with statistics
  - Visual QR codes displayed inline (80x80px)
  - Click QR codes to download PNG files
  - Download QR buttons for easy access
  - Delete buttons with confirmation dialogs
  - Sortable by creation date (newest first)

### Features

1. **Add New Redirects**
   - URL validation
   - Optional custom key input with format hints
   - Success page with QR-ready URL

2. **Browse All Redirects**
   - Complete redirect listing
   - Visit statistics (count and last visit)
   - One-click deletion with confirmation
   - Direct links to destination URLs

3. **Responsive Design**
   - Clean, modern interface
   - Mobile-friendly layout
   - Intuitive navigation

---

## Database Schema

The application uses SQLite with the following schema:

```sql
CREATE TABLE redirects (
  id TEXT PRIMARY KEY,           -- Base32 ID
  url TEXT NOT NULL,            -- Destination URL
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  visits INTEGER DEFAULT 0,     -- Visit counter
  last_visit DATETIME          -- Last access timestamp
);
```

**Database File:** `redirects.db` (created automatically)

---

## Usage Patterns

### 1. Basic URL Shortening
```bash
# Create short URL
curl -X POST http://qr.local/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://very-long-url.example.com/path/to/resource"}'

# Use returned qr.local/abc123d in QR codes
```

### 2. Custom Key Workflow
```bash
# Check if URL already exists
curl "http://qr.local/api/check?url=https://github.com/myrepo"

# If not found, create with custom key
curl -X POST http://qr.local/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/myrepo", "key": "GITHUB"}'

# Result: qr.local/GITHUB
```

### 3. Redirect Management
```bash
# List all redirects (via web interface)
open http://qr.local/human/browse

# Delete specific redirect
curl -X DELETE http://qr.local/api/delete/GITHUB
```

---

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)

### Command Line Arguments

1. **Base32 Length** - Maximum characters for generated IDs
   ```bash
   node index.js 10  # Max 10 character IDs
   ```

### Startup Messages

The server displays configuration on startup:
```
Using base32 ID length: 7 characters
QR Local server running at http://localhost:3000
Add redirects at: http://localhost:3000/human/add
Browse redirects at: http://localhost:3000/human/browse
```

---

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `409` - Conflict (duplicate key)
- `500` - Internal Server Error

All error responses include a JSON object with an `error` field describing the issue.

---

## Development

### File Structure
```
qrlocal/
├── index.js          # Main server file
├── package.json      # Dependencies and scripts
├── redirects.db      # SQLite database (auto-created)
└── README.md         # This file
```

### Dependencies
- `express` - Web framework
- `sqlite3` - Database driver  
- `base32` - Base32 encoding/decoding
- `qrcode` - QR code generation library

### Scripts
```bash
npm start     # Start server
npm run dev   # Start server (same as start)
```

---
