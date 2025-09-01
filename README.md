# QR Local - URL Shortener for Local Networks

QR Local is a Node.js application designed to create short, QR code-friendly URLs for local network access. It uses base32 encoding to ensure QR codes can utilize alphanumeric mode for optimal space efficiency.

## Features

- **Base32 URL shortening** optimized for QR codes
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
   node index.js [max_base32_length]
   ```

### Base32 Length Configuration

The server accepts an optional command line argument to set the maximum base32 ID length:

```bash
# For QR Version 1 with Q error correction (7 characters max)
node index.js 7

# For QR Version 2 with Q error correction (14 characters max)  
node index.js 14

# For QR Version 3 with Q error correction (22 characters max)
node index.js 22

# Default (7 characters)
node index.js
```

**QR Code Capacity Reference:**
- Version 1 + Q correction = 7 base32 chars max
- Version 2 + Q correction = 14 base32 chars max  
- Version 3 + Q correction = 22 base32 chars max

## API Documentation

### Base URL
All API endpoints are prefixed with your server's base URL:
```
http://localhost:3000/api/
```

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
curl -X POST http://localhost:3000/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Use custom key
curl -X POST http://localhost:3000/api/add \
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
curl "http://localhost:3000/api/check?url=https://example.com"
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
curl -X DELETE http://localhost:3000/api/delete/abc123d
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
http://localhost:3000/abc123d
```

**Note:** This endpoint automatically increments the visit counter and updates the last visit timestamp.

---

## Web Interface

The application provides a user-friendly web interface:

### Human-Readable URLs

- **Add Redirect:** `http://localhost:3000/human/add`
  - Form to create new redirects with optional custom keys
  - Real-time validation and feedback

- **Browse Redirects:** `http://localhost:3000/human/browse`  
  - Table view of all redirects with statistics
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
curl -X POST http://localhost:3000/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://very-long-url.example.com/path/to/resource"}'

# Use returned qr.local/abc123d in QR codes
```

### 2. Custom Key Workflow
```bash
# Check if URL already exists
curl "http://localhost:3000/api/check?url=https://github.com/myrepo"

# If not found, create with custom key
curl -X POST http://localhost:3000/api/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/myrepo", "key": "GITHUB"}'

# Result: qr.local/GITHUB
```

### 3. Redirect Management
```bash
# List all redirects (via web interface)
open http://localhost:3000/human/browse

# Delete specific redirect
curl -X DELETE http://localhost:3000/api/delete/GITHUB
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

### Scripts
```bash
npm start     # Start server
npm run dev   # Start server (same as start)
```

---

## License

ISC License - See package.json for details.