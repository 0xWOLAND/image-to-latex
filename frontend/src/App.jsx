import { useState, useCallback, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  useToast,
  Textarea,
  Image,
  Container,
  HStack,
  SimpleGrid,
  Progress,
  Grid,
  GridItem,
  Link,
  useColorMode,
  IconButton,
} from '@chakra-ui/react';
import { AddIcon, CloseIcon, DownloadIcon, ExternalLinkIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';
import { 
  FiMoon, 
  FiSun, 
  FiUpload, 
  FiX, 
  FiDownload, 
  FiCopy, 
  FiPlus 
} from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import hljs from 'highlight.js/lib/core';
import latex from 'highlight.js/lib/languages/latex';
import 'highlight.js/styles/monokai.css';

// Register the LaTeX language
hljs.registerLanguage('latex', latex);

function highlightLatex(code) {
  // Basic LaTeX syntax highlighting rules
  return code
    .replace(/\\[a-zA-Z]+/g, match => `<span style="color: #2E86C1;">${match}</span>`) // commands
    .replace(/\{([^}]+)\}/g, (match, content) => `<span style="color: #27AE60;">{</span>${content}<span style="color: #27AE60;">}</span>`) // braces
    .replace(/\[([^\]]+)\]/g, (match, content) => `<span style="color: #E67E22;">[</span>${content}<span style="color: #E67E22;">]</span>`) // brackets
    .replace(/\$([^$]+)\$/g, (match, content) => `<span style="color: #8E44AD;">$${content}$</span>`) // inline math
    .replace(/%(.+)$/gm, (match, content) => `<span style="color: #7F8C8D;">%${content}</span>`); // comments
}

function App() {
  const { colorMode, toggleColorMode } = useColorMode();
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreview, setImagePreview] = useState([]);
  const [latexResult, setLatexResult] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompiling, setIsCompiling] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .hljs {
        background: transparent !important;
        padding: 0 !important;
      }
      /* Line numbers container */
      .code-with-lines {
        display: table;
        width: 100%;
      }
      .line {
        display: table-row;
        line-height: 1.5;
      }
      .line-number {
        display: table-cell;
        text-align: right;
        padding-right: 1em;
        width: 1%;
        min-width: 2em;
        color: #75715e !important;
        user-select: none;
      }
      .line-content {
        display: table-cell;
        white-space: pre-wrap;
      }
      /* Existing Monokai colors */
      pre code {
        color: #f8f8f2 !important;
      }
      pre code .hljs-keyword,
      pre code .hljs-selector-tag,
      pre code .hljs-tag {
        color: #f92672 !important;
      }
      pre code .hljs-template-tag {
        color: #ae81ff !important;
      }
      pre code .hljs-number {
        color: #ae81ff !important;
      }
      pre code .hljs-variable,
      pre code .hljs-template-variable,
      pre code .hljs-attribute {
        color: #66d9ef !important;
      }
      pre code .hljs-literal {
        color: #ae81ff !important;
      }
      pre code .hljs-string,
      pre code .hljs-regexp,
      pre code .hljs-addition,
      pre code .hljs-attribute-value {
        color: #e6db74 !important;
      }
      pre code .hljs-comment,
      pre code .hljs-quote,
      pre code .hljs-deletion {
        color: #75715e !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, [colorMode]);

  const handleFile = (files) => {
    const validFiles = Array.from(files).filter(file => {
      if (file.type.startsWith('image/')) {
        return true;
      }
      toast({
        title: 'Invalid file type',
        description: `${file.name} is not an image file`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    });

    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles]);
      
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleImageChange = (e) => {
    const files = e.target.files;
    if (files) handleFile(Array.from(files));
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFile(files);
  }, []);

  const handleSubmit = async () => {
    if (selectedImages.length === 0) {
      toast({
        title: 'No images selected',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    const latexResults = [];

    try {
      // Process each image individually
      for (let i = 0; i < selectedImages.length; i++) {
        const formData = new FormData();
        formData.append('image', selectedImages[i]);

        const response = await fetch('/api/convert', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to convert image ${i + 1}`);
        }

        const data = await response.json();
        latexResults.push(data.latex);
        setProgress((i + 1) * (80 / selectedImages.length));
      }

      let finalLatex;
      
      // If there's more than one image, combine the results
      if (latexResults.length > 1) {
        const response = await fetch('/api/combine', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ latexCodes: latexResults }),
        });

        if (!response.ok) {
          throw new Error('Failed to combine LaTeX results');
        }

        const data = await response.json();
        finalLatex = data.combinedLatex;
        setLatexResult(finalLatex);
      } else {
        finalLatex = latexResults[0];
        setLatexResult(finalLatex);
      }

      // Use finalLatex instead of latexResult
      await compilePdf(finalLatex);

      setProgress(100);
      
      toast({
        title: 'Conversion successful',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Conversion failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const compilePdf = async (latex) => {
    setIsCompiling(true);
    
    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latex }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to compile PDF');
      }

      const data = await response.json();
      const baseUrl = import.meta.env.DEV ? 'http://localhost:3001' : '';
      setPdfUrl(`${baseUrl}${data.pdfUrl}`);

      toast({
        title: 'PDF compiled successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'PDF Compilation failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const clearImages = () => {
    setSelectedImages([]);
    setImagePreview([]);
    setLatexResult('');
    setProgress(0);
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreview(prev => prev.filter((_, i) => i !== index));
  };

  const addLineNumbers = (highlightedCode) => {
    const lines = highlightedCode.split('\n');
    return lines
      .map((line, index) => `
        <div class="line">
          <span class="line-number">${index + 1}</span>
          <span class="line-content">${line || ' '}</span>
        </div>
      `)
      .join('');
  };

  const openInOverleaf = () => {
    // Create a minimal LaTeX document structure, checking if latexResult already has a documentclass
    const hasDocumentClass = latexResult.includes('\\documentclass');
    const hasBeginDocument = latexResult.includes('\\begin{document}');
    
    let fullLatexDocument;
    
    if (hasDocumentClass && hasBeginDocument) {
      // If the result already has the structure, use it as is
      fullLatexDocument = latexResult;
    } else if (hasDocumentClass) {
      // If it has documentclass but no begin document
      fullLatexDocument = `${latexResult.split('\\begin{document}')[0]}
\\begin{document}

${latexResult.split('\\begin{document}')[1] || latexResult}

\\end{document}`;
    } else {
      // If it needs the complete wrapper
      fullLatexDocument = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\begin{document}

${latexResult}

\\end{document}`;
    }

    // Create a form element
    const form = document.createElement('form');
    form.method = 'post';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank';

    // Create input for the LaTeX content
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'snip';
    input.value = fullLatexDocument;

    // Add input to form
    form.appendChild(input);

    // Add form to document, submit it, and remove it
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <ChakraProvider>
      <Container maxW="container.xl" py={10}>
        <VStack spacing={8}>
          <Box position="absolute" top="4" right="4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <IconButton
                icon={colorMode === 'light' 
                  ? <FiMoon size={20} /> 
                  : <FiSun size={20} />
                }
                onClick={toggleColorMode}
                aria-label={`Toggle ${colorMode === 'light' ? 'Dark' : 'Light'} Mode`}
                variant="solid"
                bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                color={colorMode === 'dark' ? 'yellow.200' : 'gray.600'}
                _hover={{
                  bg: colorMode === 'dark' ? 'gray.600' : 'gray.200',
                  color: colorMode === 'dark' ? 'yellow.300' : 'gray.700'
                }}
                transition="all 0.2s"
              />
            </motion.div>
          </Box>

          <Heading>Image to LaTeX Converter</Heading>
          <Text>Upload images to convert them to LaTeX code</Text>

          {latexResult && (
            <Grid 
              templateColumns="repeat(2, 1fr)" 
              gap={6} 
              w="full"
              maxW="container.lg"
            >
              <GridItem>
                <Box w="full">
                  <Text mb={2} fontWeight="bold">
                    LaTeX Code:
                  </Text>
                  <Box
                    position="relative"
                    h="500px"
                    borderWidth={1}
                    borderRadius="md"
                    borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                    overflow="auto"
                    backgroundColor="#272822"
                  >
                    <pre
                      style={{
                        margin: 0,
                        minHeight: '100%',
                        padding: '16px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <code
                        className="code-with-lines"
                        dangerouslySetInnerHTML={{
                          __html: latexResult 
                            ? addLineNumbers(hljs.highlight(latexResult, { language: 'latex' }).value)
                            : ''
                        }}
                      />
                    </pre>
                  </Box>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <HStack spacing={2}>
                      <Button
                        mt={2}
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(latexResult)}
                        bg={colorMode === 'dark' ? 'gray.700' : 'white'}
                        color={colorMode === 'dark' ? 'gray.200' : 'gray.800'}
                        borderWidth={1}
                        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                        _hover={{
                          bg: colorMode === 'dark' ? 'gray.600' : 'gray.50',
                          borderColor: colorMode === 'dark' ? 'gray.500' : 'gray.300'
                        }}
                        leftIcon={<FiCopy size={16} />}
                      >
                        Copy to Clipboard
                      </Button>
                      <Button
                        mt={2}
                        size="sm"
                        onClick={openInOverleaf}
                        colorScheme="green"
                        isDisabled={!latexResult}
                        leftIcon={<ExternalLinkIcon />}
                      >
                        Open in Overleaf
                      </Button>
                    </HStack>
                  </motion.div>
                </Box>
              </GridItem>
              
              <GridItem>
                <Box w="full">
                  <Text mb={2} fontWeight="bold">
                    PDF Preview:
                  </Text>
                  <Box
                    p={4}
                    borderWidth={1}
                    borderRadius="md"
                    h="500px"
                    bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
                    borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                  >
                    {isCompiling ? (
                      <VStack spacing={4}>
                        <Text>Compiling PDF...</Text>
                        <Progress size="sm" isIndeterminate w="full" />
                      </VStack>
                    ) : pdfUrl ? (
                      <VStack spacing={4}>
                        <Box w="full" h="400px">
                          <iframe
                            src={pdfUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                          />
                        </Box>
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            as={Link}
                            href={pdfUrl}
                            download
                            leftIcon={<FiDownload size={18} />}
                            colorScheme="blue"
                            size="sm"
                          >
                            Download PDF
                          </Button>
                        </motion.div>
                      </VStack>
                    ) : (
                      <Text color="gray.500">
                        PDF preview will appear here after compilation
                      </Text>
                    )}
                  </Box>
                </Box>
              </GridItem>
            </Grid>
          )}

          <Box
            borderWidth={2}
            borderRadius="lg"
            borderStyle="dashed"
            borderColor={isDragging 
              ? "blue.500" 
              : colorMode === 'light' 
                ? "gray.200" 
                : "gray.600"
            }
            p={8}
            w="container.lg"
            maxW="container.lg"
            mx="auto"
            textAlign="center"
            position="relative"
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            transition="all 0.2s"
            bg={isDragging 
              ? (colorMode === 'light' ? "blue.50" : "blue.900") 
              : (colorMode === 'dark' ? 'gray.800' : 'transparent')
            }
            _hover={{
              borderColor: colorMode === 'dark' ? 'gray.500' : 'gray.300'
            }}
          >
            <Input
              type="file"
              accept="image/*"
              display="none"
              onChange={handleImageChange}
              id="image-upload"
              multiple
            />
            
            {imagePreview.length > 0 && (
              <SimpleGrid columns={[1, 2, 3]} spacing={4} mb={4}>
                {imagePreview.map((preview, index) => (
                  <Box key={index} position="relative">
                    <Image
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      maxH="200px"
                      mx="auto"
                      borderRadius="md"
                    />
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px'
                      }}
                    >
                      <IconButton
                        size="xs"
                        colorScheme="red"
                        onClick={() => removeImage(index)}
                        icon={<FiX size={14} />}
                      />
                    </motion.div>
                  </Box>
                ))}
              </SimpleGrid>
            )}

            <VStack spacing={4}>
              <HStack spacing={4}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <label htmlFor="image-upload">
                    <Button
                      as="span"
                      leftIcon={<FiUpload size={18} />}
                      colorScheme="blue"
                      cursor="pointer"
                      size="sm"
                    >
                      {imagePreview.length === 0 ? 'Select Images' : 'Add More Images'}
                    </Button>
                  </label>
                </motion.div>

                {imagePreview.length > 0 && (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      leftIcon={<FiX size={18} />}
                      colorScheme="red"
                      variant="outline"
                      onClick={clearImages}
                      size="sm"
                    >
                      Clear All Images
                    </Button>
                  </motion.div>
                )}
              </HStack>
              
              <Text fontSize="sm" color="gray.500">
                or drag and drop your images here
              </Text>
            </VStack>
          </Box>

          <Box w="container.lg" maxW="container.lg" mx="auto">
            <motion.div
              whileHover={{ 
                scale: selectedImages.length > 0 ? 1.02 : 1 
              }}
              whileTap={{ 
                scale: selectedImages.length > 0 ? 0.98 : 1 
              }}
            >
              <Button
                colorScheme="green"
                isLoading={isLoading}
                onClick={handleSubmit}
                w="full"
                isDisabled={selectedImages.length === 0}
                leftIcon={<FiPlus size={18} />}
              >
                Convert to LaTeX
              </Button>
            </motion.div>
          </Box>

          {isLoading && (
            <Box w="container.lg" maxW="container.lg" mx="auto">
              <Progress 
                value={progress} 
                size="sm" 
                colorScheme={colorMode === 'dark' ? 'blue' : 'green'} 
              />
              <Text 
                mt={2} 
                fontSize="sm" 
                color={colorMode === 'dark' ? 'gray.400' : 'gray.500'} 
                textAlign="center"
              >
                Converting images... {Math.round(progress)}%
              </Text>
            </Box>
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App; 