const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const latex = require('node-latex');
const { Readable } = require('stream');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Add at the top with other imports
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');

dotenv.config();

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// Add CORS configuration
app.use(cors());

// Remove the duplicate static middleware
// app.use('/', express.static(publicDir)); // Remove this line

// Keep only this static middleware
app.use('/public', express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

// Add this function to convert PDF to images
async function convertPdfToImages(pdfPath) {
  const imageUrls = [];
  
  try {
    // Create temporary directory for images if it doesn't exist
    const tempImagesDir = path.join(__dirname, 'public', 'temp');
    if (!fs.existsSync(tempImagesDir)) {
      fs.mkdirSync(tempImagesDir, { recursive: true });
    }

    const options = {
      density: 300,
      saveFilename: `page_${Date.now()}`,
      savePath: tempImagesDir,
      format: "png",
      width: 2048,
      height: 2048
    };

    const convert = fromPath(pdfPath, options);
    
    // Get the number of pages
    const pageCount = await new Promise((resolve, reject) => {
      const pdf = require('pdf-page-counter');
      pdf(fs.readFileSync(pdfPath)).then((data) => {
        resolve(data.numpages);
      }).catch(reject);
    });

    // Convert each page
    for (let i = 1; i <= pageCount; i++) {
      const result = await convert(i);
      const imagePath = result.path;
      const publicPath = `/public/temp/${path.basename(imagePath)}`;
      imageUrls.push(publicPath);
    }

    return imageUrls;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
}

app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const context = req.body.context || '';

    const completion = await openai.chat.completions.create({
      model: "grok-vision-beta",
      messages: [
        {
          role: "system",
          content: "You are a LaTeX converter. Return the complete LaTeX code needed to reproduce the image, including any necessary packages and document structure."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Context about the document: ${context}\n\nConvert this image to LaTeX code. Return the complete LaTeX document that would reproduce this image.` 
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Clean the response
    let latex = completion.choices[0].message.content;
    if (latex.includes('```')) {
      latex = latex.split('```')[1].replace('latex', '').trim();
    }
    
    res.json({ latex });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

app.post('/api/compile', async (req, res) => {
  try {
    const { latex: latexCode } = req.body;
    
    if (!latexCode || typeof latexCode !== 'string') {
      return res.status(400).json({ 
        error: 'No valid LaTeX code provided',
        received: latexCode 
      });
    }

    const timestamp = Date.now();
    const pdfFilename = `${timestamp}.pdf`;
    const outputFile = path.join(publicDir, pdfFilename);

    const input = new Readable();
    input.push(latexCode);
    input.push(null);

    const output = fs.createWriteStream(outputFile);
    const pdf = latex(input);

    await new Promise((resolve, reject) => {
      pdf.pipe(output);
      pdf.on('error', reject);
      output.on('finish', resolve);
    });

    res.json({
      success: true,
      pdfUrl: `/public/${pdfFilename}`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'PDF compilation failed',
      details: error.message
    });
  }
});

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    if (!req.file.mimetype.includes('pdf')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Uploaded file is not a PDF' });
    }

    const imageUrls = await convertPdfToImages(req.file.path);

    // Clean up the uploaded PDF
    fs.unlinkSync(req.file.path);

    res.json({ 
      success: true, 
      images: imageUrls 
    });
  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF',
      details: error.message 
    });
  }
});

app.post('/api/cleanup-temp', async (req, res) => {
  const { images } = req.body;
  try {
    for (const imageUrl of images) {
      const imagePath = path.join(__dirname, imageUrl.replace('/public', 'public'));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup temporary files' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Add error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Something broke!', details: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 