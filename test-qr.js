#!/usr/bin/env node

const QRCode = require('qrcode');

// Parse command line arguments
const args = process.argv.slice(2);
let text = 'http://qr.local/abc123';
let errorCorrection = 'M';
let version = null;
let mode = 'alphanumeric';

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--text' || arg === '-t') {
    text = args[++i] || text;
  } else if (arg === '--error' || arg === '-e') {
    errorCorrection = args[++i] || errorCorrection;
    if (!['L', 'M', 'Q', 'H'].includes(errorCorrection.toUpperCase())) {
      console.error('Error correction must be L, M, Q, or H');
      process.exit(1);
    }
    errorCorrection = errorCorrection.toUpperCase();
  } else if (arg === '--version' || arg === '-v') {
    version = parseInt(args[++i]);
    if (!version || version < 1 || version > 40) {
      console.error('QR version must be between 1 and 40');
      process.exit(1);
    }
  } else if (arg === '--mode' || arg === '-m') {
    mode = args[++i] || mode;
    if (!['numeric', 'alphanumeric', 'byte'].includes(mode.toLowerCase())) {
      console.error('QR mode must be numeric, alphanumeric, or byte');
      process.exit(1);
    }
    mode = mode.toLowerCase();
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
QR Code Test Generator

Usage: node test-qr.js [options]

Options:
  -t, --text <text>            Text to encode (default: "http://qr.local/abc123")
  -e, --error <L|M|Q|H>        Error correction level (default: M)
  -v, --version <1-40>         QR code version (default: auto)
  -m, --mode <mode>            Encoding mode: numeric, alphanumeric, byte (default: alphanumeric)
  -h, --help                   Show this help message

Examples:
  node test-qr.js                                    # Default settings
  node test-qr.js -t "http://example.com/test"       # Custom text
  node test-qr.js -v 1 -e M -m alphanumeric          # Specific version and settings
  node test-qr.js -t "http://qr.local/abcdef" -v 1   # Test specific length
    `);
    process.exit(0);
  }
}

async function generateTestQR() {
  console.log(`Testing QR code generation:`);
  console.log(`Text: "${text}" (${text.length} characters)`);
  console.log(`Error correction: ${errorCorrection}`);
  console.log(`Version: ${version || 'auto'}`);
  console.log(`Mode: ${mode}`);
  console.log('');

  const options = {
    errorCorrectionLevel: errorCorrection,
    type: 'terminal', // Display in terminal
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };
  
  // Set version if specified
  if (version) {
    options.version = version;
  }
  
  // Set mode based on content and user preference
  if (mode === 'numeric' && /^\d+$/.test(text)) {
    options.mode = 'numeric';
  } else if (mode === 'alphanumeric' && /^[A-Z0-9 $%*+\-./:]*$/i.test(text)) {
    options.mode = 'alphanumeric';
  } else {
    options.mode = 'byte';
  }
  
  console.log(`Actual mode used: ${options.mode}`);
  
  try {
    // Generate QR code for terminal display
    const qrString = await QRCode.toString(text, options);
    console.log('QR Code:');
    console.log(qrString);
    
    // Also generate PNG data URL to get actual QR info
    const pngOptions = { ...options, type: 'png' };
    const dataUrl = await QRCode.toDataURL(text, pngOptions);
    
    console.log('Generation successful!');
    console.log(`Data URL length: ${dataUrl.length} characters`);
    
  } catch (error) {
    console.error('QR Code generation failed:', error.message);
    
    if (error.message.includes('too big')) {
      console.log('\nSuggestions:');
      console.log('- Try a higher version number (-v 2 or higher)');
      console.log('- Use lower error correction (-e L)');
      console.log('- Shorten the text');
    }
    
    process.exit(1);
  }
}

generateTestQR().catch(console.error);