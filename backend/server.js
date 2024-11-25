const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const latex = require('node-latex');
const { Readable } = require('stream');
const cors = require('cors');

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

app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageBuffer = fs.readFileSync(req.file.path);
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
              text: "Convert this image to LaTeX code. Return the complete LaTeX document that would reproduce this image." 
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

app.post('/api/combine', async (req, res) => {
  try {
    const { latexCodes, fix } = req.body;
    
    if (!latexCodes || !Array.isArray(latexCodes)) {
      return res.status(400).json({ error: 'Invalid LaTeX codes provided' });
    }

    const prompt = fix 
      ? `Fix this LaTeX code to make it render correctly:\n\n${latexCodes[0]}`
      : `Combine these LaTeX documents into a single coherent document, preserving all necessary packages and structure:\n\n${latexCodes.join('\n\n=====\n\n')}`;

    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are a LaTeX processor. Return complete LaTeX documents with proper structure and all necessary packages."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let latex = completion.choices[0].message.content;
    if (latex.includes('```')) {
      latex = latex.split('```')[1].replace('latex', '').trim();
    }

    res.json({ combinedLatex: latex });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to combine LaTeX codes' });
  }
});

app.post('/api/compile', async (req, res) => {
  const { latex: latexCode } = req.body;
  console.log("LaTeX code:", latexCode);
  if (!latexCode) {
    return res.status(400).json({ error: 'No LaTeX code provided' });
  }

  const timestamp = Date.now();
  const pdfFilename = `${timestamp}.pdf`;
  const outputFile = path.join(publicDir, pdfFilename);

  try {
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

    // Log the file creation
    console.log(`PDF file created at: ${outputFile}`);
    console.log(`File exists: ${fs.existsSync(outputFile)}`);

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

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Add this debugging route to check if files exist
app.get('/public/*', (req, res, next) => {
  console.log('Attempting to access:', req.path);
  console.log('Full file path:', path.join(__dirname, req.path));
  next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!', details: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 