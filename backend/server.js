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
const os = require('os');

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

// Add this function to help manage Typst document structure
function wrapTypstCode(code) {
  // Check if the code already has imports or page settings
  const hasImports = code.includes('#import');
  const hasPageSettings = code.includes('#set page');
  const hasShowSettings = code.includes('#show:');

  // Start with basic imports if needed
  let wrappedCode = '';
  if (!hasImports) {
    wrappedCode += `#import "@preview/cetz:0.2.0"
#import "@preview/physica:0.8.0"

`;
  }

  // Add basic page settings if needed
  if (!hasPageSettings) {
    wrappedCode += `#set page(
  paper: "us-letter",
  margin: (top: 1in, bottom: 1in, left: 1in, right: 1in),
)

`;
  }

  // Add the main content, cleaning up any redundant settings
  let cleanedCode = code
    // Remove any duplicate imports
    .replace(/#import\s+"@preview\/cetz:0\.2\.0"\s*\n?/g, '')
    .replace(/#import\s+"@preview\/physica:0\.8\.0"\s*\n?/g, '')
    // Remove any duplicate page settings
    .replace(/#set\s+page\s*\([^)]+\)\s*\n?/g, '')
    // Remove any duplicate show settings
    .replace(/#show:\s*doc\s*=>\s*columns\s*\([^)]+\)\s*\n?/g, '')
    // Fix spacing units
    .replace(/#h\((\d+)\)/g, '#h($1em)') // Add 'em' unit to #h() spacing
    .replace(/#v\((\d+)\)/g, '#v($1em)') // Add 'em' unit to #v() spacing
    .trim();

  wrappedCode += cleanedCode;

  return wrappedCode;
}

app.post('/api/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { format } = req.body;
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    const systemPrompt = format === 'typst' 
      ? "You are a Typst converter. Return ONLY the mathematical content in Typst format, without any imports or page settings. These will be added later."
      : "You are a LaTeX converter. Return the complete LaTeX code needed to reproduce the image, including any necessary packages and document structure.";

    const userPrompt = format === 'typst'
      ? "Convert this image to Typst code. Return ONLY the mathematical content without imports or page settings."
      : "Convert this image to LaTeX code. Return the complete LaTeX document that would reproduce this image.";

    const completion = await openai.chat.completions.create({
      model: "grok-vision-beta",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: userPrompt
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
    let code = completion.choices[0].message.content;
    if (code.includes('```')) {
      code = code.split('```')[1].replace(/(latex|typst)/i, '').trim();
    }

    if (format === 'typst') {
      code = wrapTypstCode(code);
    }
    
    res.json({ 
      latex: format === 'latex' ? code : null,
      typst: format === 'typst' ? code : null
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

app.post('/api/combine', async (req, res) => {
  try {
    const { codes, format, fix } = req.body;
    
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ error: 'Invalid codes provided' });
    }

    const systemPrompt = format === 'typst'
      ? "You are a Typst processor. Return ONLY the Typst code without any explanations or markdown formatting. Do not include imports or page settings - these will be added later."
      : "You are a LaTeX processor. Return ONLY the LaTeX code without any explanations or markdown formatting. Always start with \\documentclass and include all necessary packages.";

    const prompt = fix 
      ? `Fix this ${format} code to make it render correctly:\n\n${codes[0]}`
      : `Combine these ${format} documents into a single coherent document. Return ONLY the code without any markdown formatting or explanations:\n\n${codes.join('\n\n')}`;

    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let code = completion.choices[0].message.content;

    if (code.includes('```')) {
      const matches = code.match(/```(?:latex|typst)?([\s\S]*?)```/);
      code = matches ? matches[1].trim() : code;
    }

    // Add default structure if missing
    if (format === 'latex' && !code.includes('\\documentclass')) {
      code = `\\documentclass{article}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\\begin{document}\n${code}\n\\end{document}`;
    } else if (format === 'typst') {
      code = wrapTypstCode(code);
    }

    if (!code || code.trim().length === 0) {
      throw new Error('No valid content generated');
    }
    
    res.json({ 
      combinedLatex: format === 'latex' ? code : null,
      combinedTypst: format === 'typst' ? code : null,
      success: true 
    });
  } catch (error) {
    res.status(500).json({ 
      error: `Failed to combine ${format} codes`,
      details: error.message 
    });
  }
});

app.post('/api/compile', async (req, res) => {
  try {
    const { code, format } = req.body;
    const timestamp = Date.now();
    const outputFileName = `output_${timestamp}.pdf`;
    const outputPath = path.join(__dirname, 'public', 'pdfs', outputFileName);

    if (format === 'typst') {
      await compileTypst(code, outputPath);
    } else {
      const input = new Readable();
      input.push(code);
      input.push(null);

      const output = fs.createWriteStream(outputPath);
      const pdf = latex(input);

      await new Promise((resolve, reject) => {
        pdf.pipe(output);
        pdf.on('error', reject);
        output.on('finish', resolve);
      });
    }

    res.json({ pdfUrl: `/pdfs/${outputFileName}` });
  } catch (error) {
    res.status(500).json({ 
      error: 'Compilation failed',
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

async function compileTypst(code, outputPath) {
  // Ensure the pdfs directory exists
  const pdfsDir = path.join(__dirname, 'public', 'pdfs');
  if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
  }

  // Generate a random ID for the output file
  const randomId = Math.random().toString(36).substring(2, 15);
  const outputName = `${randomId}.pdf`;

  // Write Typst code to a temporary file
  const typstFile = path.join(os.tmpdir(), 'test.typ');
  
  // Log the Typst code being generated
  console.log('\nGenerated Typst Code:');
  console.log('-------------------');
  console.log(code);
  console.log('-------------------\n');

  await fs.promises.writeFile(typstFile, code);

  try {
    // Compile using Typst CLI with the random output name
    await execAsync(`typst compile test.typ ${outputName}`, {
      cwd: os.tmpdir() // Set working directory to temp directory
    });
    
    // Move the output PDF to the desired location
    await fs.promises.rename(
      path.join(os.tmpdir(), outputName),
      outputPath
    );
    
    // Clean up temporary file
    await fs.promises.unlink(typstFile);
  } catch (error) {
    console.error('Typst compilation error:', error);
    throw new Error(`Typst compilation failed: ${error.message}`);
  }
}

function convertToTypst(latexCode) {
  // This is a basic conversion - you'll need to expand this based on your needs
  return latexCode
    .replace(/\\begin{equation\*?}/, "$")
    .replace(/\\end{equation\*?}/, "$")
    .replace(/\\frac{([^}]*)}{([^}]*)}/, "#frac($1, $2)")
    .replace(/\\sqrt{([^}]*)}/, "#sqrt($1)")
    .replace(/\\sum/, "#sum")
    .replace(/\\int/, "#integral")
    // Add more conversions as needed
    ;
} 