require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CONVERTED_DIR = path.join(__dirname, 'converted');
const MAX_CONCURRENT_CONVERSIONS = 4; // Process 4 images at a time

// Ensure directories exist
[UPLOAD_DIR, CONVERTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Enhanced CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // In production, specify your frontend URL
    const allowedOrigins = ['https://your-production-domain.com'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10MB limit per file, max 10 files
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Image converter backend is running',
    timestamp: new Date(),
    directories: {
      uploads: UPLOAD_DIR,
      converted: CONVERTED_DIR
    }
  });
});

// Process files in batches to avoid overloading the system
async function processInBatches(files, format) {
  const results = [];
  
  for (let i = 0; i < files.length; i += MAX_CONCURRENT_CONVERSIONS) {
    const batch = files.slice(i, i + MAX_CONCURRENT_CONVERSIONS);
    const batchResults = await Promise.all(batch.map(file => convertFile(file, format)));
    results.push(...batchResults);
  }
  
  return results;
}

async function convertFile(file, format) {
  const outputFilename = `${file.filename.split('.')[0]}.${format}`;
  const outputPath = path.join(CONVERTED_DIR, outputFilename);

  await sharp(file.path)
    .toFormat(format)
    .toFile(outputPath);

  // Clean up original file
  fs.unlink(file.path, (err) => {
    if (err) console.error('Error deleting original:', err);
  });

  // Auto-delete converted file after 1 hour
  setTimeout(() => {
    fs.unlink(outputPath, (err) => {
      if (!err) console.log(`Auto-deleted: ${outputFilename}`);
    });
  }, 60 * 60 * 1000);

  return {
    originalName: file.originalname,
    url: `/converted/${outputFilename}`,
    filename: outputFilename,
    format: format.toUpperCase()
  };
}

app.post('/convert', upload.array('images', 10), async (req, res) => { 
  try {
    if (!req.files || req.files.length === 0) throw new Error('No files uploaded');

    const format = req.body.format || 'png';
    const results = await processInBatches(req.files, format);

    res.json({
      success: true,
      results
    });

  } catch (err) {
    console.error('Conversion error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Conversion failed'
    });
  }
});

// Static files
app.use('/converted', express.static(CONVERTED_DIR));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 Server running on:
  - Local: http://localhost:${PORT}
  - Network: http://${getIPAddress()}:${PORT}
  
  📁 Uploads directory: ${UPLOAD_DIR}
  📁 Converted directory: ${CONVERTED_DIR}
  
  ✅ Health check: http://localhost:${PORT}/health
  `);
});

function getIPAddress() {
  const interfaces = require('os').networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}