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
      : `Combine these LaTeX documents into a single coherent document. Return ONLY the LaTeX code without any markdown formatting or explanations:\n\n${latexCodes.join('\n\n')}`;

    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are a LaTeX processor. Return ONLY the LaTeX code without any explanations or markdown formatting. Always start with \\documentclass and include all necessary packages."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let latex = completion.choices[0].message.content;

    if (latex.includes('```')) {
      const matches = latex.match(/```(?:latex)?([\s\S]*?)```/);
      latex = matches ? matches[1].trim() : latex;
    }

    if (!latex.includes('\\documentclass')) {
      latex = `\\documentclass{article}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\\begin{document}\n${latex}\n\\end{document}`;
    }

    if (!latex || latex.trim().length === 0) {
      throw new Error('No valid LaTeX content generated');
    }
    
    res.json({ 
      combinedLatex: latex,
      success: true 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to combine LaTeX codes',
      details: error.message 
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