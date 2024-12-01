import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// Convert __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const progressEmitter = new EventEmitter();

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

// Add new endpoint for SSE progress updates
app.get('/api/convert-multiple/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (progress) => {
    res.write(`data: ${JSON.stringify({ progress })}\n\n`);
  };

  progressEmitter.on('progress', sendProgress);

  req.on('close', () => {
    progressEmitter.removeListener('progress', sendProgress);
  });
});

app.post('/api/convert-multiple', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const context = req.body.context || '';
    const totalImages = req.files.length;
    let completedImages = 0;
    
    // Process all images in parallel
    const conversionPromises = req.files.map(async (file, index) => {
      try {
        const imageBuffer = fs.readFileSync(file.path);
        const base64Image = imageBuffer.toString('base64');

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

        // Clean up the file
        fs.unlinkSync(file.path);

        // Clean the response
        let latex = completion.choices[0].message.content;
        if (latex.includes('```')) {
          latex = latex.split('```')[1].replace('latex', '').trim();
        }

        completedImages++;
        const progress = Math.round((completedImages / totalImages) * 100);
        progressEmitter.emit('progress', progress);
        
        return { 
          success: true, 
          latex,
          progress
        };
      } catch (error) {
        console.error(`Error processing image ${file.originalname}:`, error);
        completedImages++;
        const progress = Math.round((completedImages / totalImages) * 100);
        progressEmitter.emit('progress', progress);
        
        return { 
          success: false, 
          error: error.message, 
          file: file.originalname,
          progress
        };
      }
    });

    // Wait for all conversions to complete
    const results = await Promise.allSettled(conversionPromises);

    // Process results
    const successfulResults = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value.latex);

    const failedResults = results
      .filter(result => result.status === 'rejected' || !result.value.success)
      .map(result => result.status === 'rejected' ? result.reason : result.value);

    if (successfulResults.length === 0) {
      return res.status(500).json({
        error: 'All conversions failed',
        failures: failedResults,
        progress: 100
      });
    }

    res.json({
      success: true,
      results: successfulResults,
      failedCount: failedResults.length,
      failures: failedResults,
      progress: 100
    });

  } catch (error) {
    console.error('Error in batch conversion:', error);
    res.status(500).json({ 
      error: 'Batch conversion failed', 
      details: error.message,
      progress: 100
    });
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

    // Encode the LaTeX content for URL
    const encodedLatex = encodeURIComponent(latexCode);
    
    // Make request to latex-online service
    const response = await fetch(`https://latexonline.cc/compile?text=${encodedLatex}&command=pdflatex`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LaTeX compilation failed: ${errorText}`);
    }

    // Get the PDF buffer using arrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Save the PDF locally
    const timestamp = Date.now();
    const pdfFilename = `${timestamp}.pdf`;
    const outputFile = path.join(publicDir, pdfFilename);
    
    fs.writeFileSync(outputFile, pdfBuffer);

    res.json({
      success: true,
      pdfUrl: `/public/${pdfFilename}`
    });
  } catch (error) {
    console.error('Compilation error:', error);
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