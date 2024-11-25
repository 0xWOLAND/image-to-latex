const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

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
          content: "You are a LaTeX converter. You must respond with ONLY the LaTeX code needed to reproduce the image. No explanations, no markdown formatting, no additional text."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Convert this image to LaTeX code. Return ONLY the LaTeX code with no additional text or formatting." 
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

    // Clean the response if it contains markdown or explanations
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
    const { latexCodes } = req.body;
    
    if (!latexCodes || !Array.isArray(latexCodes)) {
      return res.status(400).json({ error: 'Invalid LaTeX codes provided' });
    }

    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are a LaTeX combiner. You must respond with ONLY the combined LaTeX code. No explanations, no markdown formatting, no additional text."
        },
        {
          role: "user",
          content: `Here are multiple LaTeX code snippets. Combine them into a single coherent LaTeX document. Return ONLY the combined LaTeX code with no additional text or formatting:\n\n${latexCodes.join('\n\n=====\n\n')}`
        }
      ]
    });

    // Clean the response if it contains markdown or explanations
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 