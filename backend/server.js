const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
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
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Convert this image to LaTeX code. Please provide the complete LaTeX code that would reproduce this image." 
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

    res.json({ latex: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 