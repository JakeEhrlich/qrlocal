const express = require('express');
const base32 = require('base32');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

// Parse command line arguments
const args = process.argv.slice(2);
let maxBase32Length = 7; // Default for QR Version 1 with Q error correction
let qrErrorCorrection = 'Q'; // Default error correction level
let qrVersion = null; // Auto-detect version by default
let qrMode = 'alphanumeric'; // Default encoding mode

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--qr-error' || arg === '-e') {
    qrErrorCorrection = args[++i] || 'Q';
    if (!['L', 'M', 'Q', 'H'].includes(qrErrorCorrection.toUpperCase())) {
      console.error('Error correction must be L, M, Q, or H');
      process.exit(1);
    }
    qrErrorCorrection = qrErrorCorrection.toUpperCase();
  } else if (arg === '--qr-version' || arg === '-v') {
    qrVersion = parseInt(args[++i]);
    if (!qrVersion || qrVersion < 1 || qrVersion > 40) {
      console.error('QR version must be between 1 and 40');
      process.exit(1);
    }
  } else if (arg === '--qr-mode' || arg === '-m') {
    qrMode = args[++i] || 'alphanumeric';
    if (!['numeric', 'alphanumeric', 'byte'].includes(qrMode.toLowerCase())) {
      console.error('QR mode must be numeric, alphanumeric, or byte');
      process.exit(1);
    }
    qrMode = qrMode.toLowerCase();
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
QR Local - URL Shortener with QR Code Generation

Usage: node index.js [base32_length] [options]

Arguments:
  base32_length         Maximum length for base32 IDs (1-20, default: 7)

QR Code Options:
  -e, --qr-error <L|M|Q|H>     Error correction level (default: Q)
  -v, --qr-version <1-40>      QR code version (default: auto)
  -m, --qr-mode <mode>         Encoding mode: numeric, alphanumeric, byte (default: alphanumeric)
  -h, --help                   Show this help message

Examples:
  node index.js 7                           # Default settings
  node index.js 14 -e H -v 2                # Version 2 with high error correction
  node index.js 10 -m byte -e L             # Byte mode with low error correction
    `);
    process.exit(0);
  } else if (!isNaN(parseInt(arg))) {
    // First numeric argument is base32 length
    const length = parseInt(arg);
    if (length > 0 && length <= 20) {
      maxBase32Length = length;
    } else {
      console.error('Base32 length must be between 1 and 20');
      process.exit(1);
    }
  }
}

console.log(`Using base32 ID length: ${maxBase32Length} characters`);
console.log(`QR Code settings: Error correction=${qrErrorCorrection}, Version=${qrVersion || 'auto'}, Mode=${qrMode}`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, 'redirects.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS redirects (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        visits INTEGER DEFAULT 0,
        last_visit DATETIME
      )
    `);
  });
}

initDatabase();

// QR Code generation utility
async function generateQRCode(text, format = 'png') {
  const options = {
    errorCorrectionLevel: qrErrorCorrection,
    type: format === 'svg' ? 'svg' : 'png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };
  
  // Set version if specified
  if (qrVersion) {
    options.version = qrVersion;
  }
  
  // Set mode based on content and user preference
  if (qrMode === 'numeric' && /^\d+$/.test(text)) {
    options.mode = 'numeric';
  } else if (qrMode === 'alphanumeric' && /^[A-Z0-9 $%*+\-./:]*$/i.test(text)) {
    options.mode = 'alphanumeric';
  } else {
    options.mode = 'byte';
  }
  
  try {
    if (format === 'svg') {
      return await QRCode.toString(text, options);
    } else {
      return await QRCode.toDataURL(text, options);
    }
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw error;
  }
}

async function generateBase32Id(url) {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString();
    const hash = require('crypto').createHash('md5').update(url + timestamp + random + attempts).digest('hex');
    
    // Convert hex to base32 and trim to desired length
    let id = base32.encode(hash).toLowerCase().replace(/=/g, '').substring(0, maxBase32Length);
    
    // Check for collision in database
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM redirects WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!existing) {
      return id;
    }
    
    attempts++;
  }
  
  throw new Error('Unable to generate unique ID after maximum attempts');
}

app.get('/:base32id', (req, res) => {
  const id = req.params.base32id.toLowerCase();
  
  db.get('SELECT * FROM redirects WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    
    if (row) {
      db.run(
        'UPDATE redirects SET visits = visits + 1, last_visit = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
        (err) => {
          if (err) console.error(err);
        }
      );
      res.redirect(row.url);
    } else {
      res.status(404).send('Redirect not found');
    }
  });
});

app.get('/human/add', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Local - Add Redirect</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        form { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        input[type="url"], input[type="text"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #005a87; }
        .result { margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>Add New Redirect</h1>
      <form action="/api/add" method="POST">
        <label for="url">URL to redirect to:</label>
        <input type="url" id="url" name="url" required placeholder="https://example.com">
        
        <label for="key">Custom Key (optional):</label>
        <input type="text" id="key" name="key" placeholder="Leave empty to auto-generate" maxlength="${maxBase32Length}">
        <small style="color: #666; font-size: 0.9em;">Base32 characters only (A-Z, 2-7), max ${maxBase32Length} chars</small>
        
        <button type="submit">Create QR Code</button>
      </form>
      <p><a href="/human/browse">Browse all redirects</a></p>
    </body>
    </html>
  `);
});

app.get('/human/browse', (req, res) => {
  db.all('SELECT * FROM redirects ORDER BY created DESC', (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Local - Browse Redirects</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .qr-link { font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
          .stats { color: #666; font-size: 0.9em; }
          .qr-container { text-align: center; }
          .qr-code { width: 80px; height: 80px; cursor: pointer; border: 1px solid #ddd; border-radius: 4px; }
          .qr-code:hover { border-color: #007cba; box-shadow: 0 0 5px rgba(0,124,186,0.3); }
          .delete-btn { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8em; margin-right: 5px; }
          .delete-btn:hover { background: #c82333; }
          .download-btn { background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8em; }
          .download-btn:hover { background: #218838; }
        </style>
        <script>
          function deleteRedirect(id) {
            if (confirm('Are you sure you want to delete this redirect? This action cannot be undone.')) {
              fetch('/api/delete/' + id, { method: 'DELETE' })
                .then(response => response.json())
                .then(data => {
                  if (data.success) {
                    alert('Redirect deleted successfully');
                    location.reload();
                  } else {
                    alert('Error: ' + data.error);
                  }
                })
                .catch(error => {
                  console.error('Error:', error);
                  alert('Error deleting redirect');
                });
            }
          }
          
          function downloadQR(id) {
            // Create a temporary link to trigger download
            const link = document.createElement('a');
            link.href = '/download/qr/' + id + '/png';
            link.download = 'qr-' + id + '.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        </script>
      </head>
      <body>
        <h1>All Redirects</h1>
    `;
    
    if (rows.length === 0) {
      html += '<p>No redirects created yet.</p>';
    } else {
      html += `
        <table>
          <tr>
            <th>QR Code</th>
            <th>Short URL</th>
            <th>Destination URL</th>
            <th>Created</th>
            <th>Visits</th>
            <th>Last Visit</th>
            <th>Actions</th>
          </tr>
      `;
      
      rows.forEach(row => {
        const created = new Date(row.created).toLocaleDateString();
        const lastVisit = row.last_visit ? new Date(row.last_visit).toLocaleDateString() : 'Never';
        
        html += `
          <tr>
            <td>
              <div class="qr-container">
                <img src="/qr/${row.id}/png" alt="QR Code" class="qr-code" onclick="downloadQR('${row.id}')" title="Click to download QR code">
              </div>
            </td>
            <td><span class="qr-link">qr.local/${row.id}</span></td>
            <td><a href="${row.url}" target="_blank">${row.url}</a></td>
            <td class="stats">${created}</td>
            <td class="stats">${row.visits}</td>
            <td class="stats">${lastVisit}</td>
            <td>
              <button class="delete-btn" onclick="deleteRedirect('${row.id}')">Delete</button>
              <button class="download-btn" onclick="downloadQR('${row.id}')">Download QR</button>
            </td>
          </tr>
        `;
      });
      
      html += '</table>';
    }
    
    html += `
        <p><a href="/human/add">Add new redirect</a></p>
      </body>
      </html>
    `;
    
    res.send(html);
  });
});

app.post('/api/add', async (req, res) => {
  const { url, key } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  let id;
  
  if (key) {
    // Validate custom key format
    if (typeof key !== 'string' || key.length === 0 || key.length > maxBase32Length) {
      return res.status(400).json({ 
        error: `Custom key must be a string between 1 and ${maxBase32Length} characters` 
      });
    }
    
    // Validate base32 characters (A-Z, 2-7)
    if (!/^[A-Z2-7]+$/i.test(key)) {
      return res.status(400).json({ 
        error: 'Custom key must contain only base32 characters (A-Z, 2-7)' 
      });
    }
    
    // Check if custom key already exists
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM redirects WHERE id = ?', [key.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existing) {
      return res.status(409).json({ 
        error: 'Custom key already exists. Choose a different key.' 
      });
    }
    
    id = key.toLowerCase();
  } else {
    // Generate new ID
    try {
      id = await generateBase32Id(url);
    } catch (error) {
      console.error('Error generating ID:', error);
      return res.status(500).json({ error: 'Unable to generate unique ID' });
    }
  }
  
  try {
    
    db.run(
      'INSERT INTO redirects (id, url) VALUES (?, ?)',
      [id, url],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const qrUrl = `qr.local/${id}`;
        
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
          res.json({
            success: true,
            qr_url: qrUrl,
            base32_id: id,
            original_url: url
          });
        } else {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>QR Local - Redirect Created</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .result { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .qr-url { font-family: monospace; font-size: 1.2em; background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 10px 0; }
                a { color: #007cba; text-decoration: none; }
                a:hover { text-decoration: underline; }
              </style>
            </head>
            <body>
              <h1>Redirect Created Successfully!</h1>
              <div class="result">
                <p><strong>QR URL:</strong></p>
                <div class="qr-url">${qrUrl}</div>
                <p><strong>Redirects to:</strong> <a href="${url}" target="_blank">${url}</a></p>
                <p><strong>Base32 ID:</strong> ${id}</p>
              </div>
              <p><a href="/human/add">Add another redirect</a> | <a href="/human/browse">Browse all redirects</a></p>
            </body>
            </html>
          `);
        }
      }
    );
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/check', (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  db.get('SELECT * FROM redirects WHERE url = ?', [url], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row) {
      const created = new Date(row.created);
      const lastVisit = row.last_visit ? new Date(row.last_visit) : null;
      
      res.json({
        exists: true,
        qr_url: `qr.local/${row.id}`,
        base32_id: row.id,
        original_url: row.url,
        created: created.toISOString(),
        visits: row.visits,
        last_visit: lastVisit ? lastVisit.toISOString() : null
      });
    } else {
      res.json({
        exists: false,
        message: 'No redirect found for this URL'
      });
    }
  });
});

// QR Code display endpoint (for inline display)
app.get('/qr/:id/png', async (req, res) => {
  const { id } = req.params;
  
  // Get redirect from database
  db.get('SELECT * FROM redirects WHERE id = ?', [id.toLowerCase()], async (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    
    if (!row) {
      return res.status(404).send('Redirect not found');
    }
    
    try {
      const qrUrl = `qr.local/${row.id}`;
      const qrCode = await generateQRCode(qrUrl, 'png');
      
      // Convert data URL to buffer for PNG
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.send(buffer);
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).send('Failed to generate QR code');
    }
  });
});

// QR Code download endpoint - PNG
app.get('/download/qr/:id/png', async (req, res) => {
  const { id } = req.params;
  const format = 'png';
  
  // Get redirect from database
  db.get('SELECT * FROM redirects WHERE id = ?', [id.toLowerCase()], async (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Redirect not found' });
    }
    
    try {
      const qrUrl = `qr.local/${row.id}`;
      const qrCode = await generateQRCode(qrUrl, format.toLowerCase());
      
      if (format.toLowerCase() === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `attachment; filename="qr-${row.id}.svg"`);
        res.send(qrCode);
      } else {
        // Convert data URL to buffer for PNG
        const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="qr-${row.id}.png"`);
        res.send(buffer);
      }
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });
});

// QR Code download endpoint - SVG
app.get('/download/qr/:id/svg', async (req, res) => {
  const { id } = req.params;
  const format = 'svg';
  
  // Get redirect from database
  db.get('SELECT * FROM redirects WHERE id = ?', [id.toLowerCase()], async (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Redirect not found' });
    }
    
    try {
      const qrUrl = `qr.local/${row.id}`;
      const qrCode = await generateQRCode(qrUrl, format);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="qr-${row.id}.svg"`);
      res.send(qrCode);
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });
});

app.delete('/api/delete/:id', (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }
  
  // First check if the redirect exists
  db.get('SELECT * FROM redirects WHERE id = ?', [id.toLowerCase()], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Redirect not found' });
    }
    
    // Delete the redirect
    db.run('DELETE FROM redirects WHERE id = ?', [id.toLowerCase()], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        message: 'Redirect deleted successfully',
        deleted_id: row.id,
        deleted_url: row.url
      });
    });
  });
});

app.listen(port, () => {
  console.log(`QR Local server running at http://localhost:${port}`);
  console.log(`Add redirects at: http://localhost:${port}/human/add`);
  console.log(`Browse redirects at: http://localhost:${port}/human/browse`);
});