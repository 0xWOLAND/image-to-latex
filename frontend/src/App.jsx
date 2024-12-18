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
  FiPlus, 
  FiFileText, 
  FiRefreshCw 
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
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const [tempImages, setTempImages] = useState([]);
  const [documentContext, setDocumentContext] = useState('');
  const toast = useToast();
  const [pdfError, setPdfError] = useState(false);

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
    Array.from(files).forEach(file => {
      if (file.type.includes('pdf')) {
        handlePdfUpload(file);
      } else if (file.type.startsWith('image/')) {
        setSelectedImages(prev => [...prev, file]);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not an image or PDF file`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    });
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

    try {
      // Calculate how much progress each image conversion should represent
      const progressPerImage = 60 / selectedImages.length; // Reserve 60% for image conversion
      let currentProgress = 0;

      // Create form data with multiple images
      const formData = new FormData();
      selectedImages.forEach(image => {
        formData.append('images', image);
      });
      formData.append('context', documentContext);

      // Set initial progress for starting the request
      setProgress(5);

      // Create EventSource for progress updates
      const eventSource = new EventSource('/api/convert-multiple/progress');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.progress) {
          // Calculate total progress (5% initial + up to 60% for conversions)
          const conversionProgress = 5 + (data.progress * 0.6);
          setProgress(Math.min(65, conversionProgress));
        }
      };

      const response = await fetch('/api/convert-multiple', {
        method: 'POST',
        body: formData,
      });

      // Close the EventSource
      eventSource.close();

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      const data = await response.json();
      
      setProgress(70);

      if (data.failedCount > 0) {
        toast({
          title: `${data.failedCount} image(s) failed to convert`,
          description: 'Some images were not converted successfully',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }

      if (data.results.length > 0) {
        setProgress(80);
        
        const combinedLatex = combineLatexDocuments(data.results);
        setLatexResult(combinedLatex);

        setProgress(90);
        
        await compilePdf(combinedLatex);

        toast({
          title: 'Conversion successful',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      setProgress(100);
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
    setPdfError(false);
    
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
      setPdfError(false);

      toast({
        title: 'PDF compiled successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      setPdfError(true);
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

  const handlePdfUpload = async (file) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsPdfProcessing(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process PDF');
      }

      const data = await response.json();
      setImagePreview(data.images);
      setTempImages(data.images);
      
      // Convert the image URLs to File objects
      const imageFiles = await Promise.all(
        data.images.map(async (url) => {
          const response = await fetch(url);
          const blob = await response.blob();
          return new File([blob], `page_${Math.random()}.png`, { type: 'image/png' });
        })
      );
      
      setSelectedImages(imageFiles);
    } catch (error) {
      toast({
        title: 'PDF processing failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsPdfProcessing(false);
    }
  };

  const cleanup = async () => {
    if (tempImages.length > 0) {
      try {
        await fetch('/api/cleanup-temp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ images: tempImages }),
        });
      } catch (error) {
        console.error('Failed to cleanup temporary files:', error);
      }
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [tempImages]);

  // Add this new function to combine LaTeX documents
  const combineLatexDocuments = (latexDocs) => {
    // Set to store unique packages
    const packages = new Set();
    // Array to store document contents
    const contents = [];

    latexDocs.forEach(doc => {
      // Extract packages
      const packageMatches = doc.match(/\\usepackage(\[.*?\])?\{.*?\}/g) || [];
      packageMatches.forEach(pkg => packages.add(pkg));

      // Extract content between \begin{document} and \end{document}
      const contentMatch = doc.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
      if (contentMatch) {
        contents.push(contentMatch[1].trim());
      } else {
        // If no document environment found, add the whole content
        contents.push(doc.trim());
      }
    });

    // Build the combined document
    return `\\documentclass{article}
${Array.from(packages).join('\n')}

\\begin{document}

${contents.join('\n\n')}

\\end{document}`;
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
                        <Box w="full" h="400px" position="relative">
                          <iframe
                            src={pdfUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                            onError={() => setPdfError(true)}
                          />
                          {pdfError && (
                            <VStack
                              position="absolute"
                              top="0"
                              left="0"
                              right="0"
                              bottom="0"
                              justify="center"
                              align="center"
                              bg={colorMode === 'dark' ? 'rgba(23, 25, 35, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
                            >
                              <Text color="red.500" mb={4}>Failed to load PDF preview</Text>
                              <Button
                                onClick={() => compilePdf(latexResult)}
                                leftIcon={<FiRefreshCw size={16} />}
                                colorScheme="blue"
                                size="sm"
                              >
                                Retry Compilation
                              </Button>
                            </VStack>
                          )}
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
              accept="image/*,application/pdf"
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
                      {imagePreview.length === 0 ? 'Select Images or PDFs' : 'Add More Files'}
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
                or drag and drop your images or PDFs here
              </Text>
            </VStack>
          </Box>

          <Box w="container.lg" maxW="container.lg" mx="auto">
            <Text mb={2} fontWeight="bold">
              Document Context (Optional):
            </Text>
            <Textarea
              value={documentContext}
              onChange={(e) => setDocumentContext(e.target.value)}
              placeholder="Provide context about the document (e.g., 'This is a math homework about linear algebra' or 'These are chemical equations about organic chemistry')"
              size="sm"
              mb={4}
              resize="vertical"
              maxH="200px"
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
            />
            
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

          {isPdfProcessing && (
            <Box w="container.lg" maxW="container.lg" mx="auto">
              <Progress size="sm" isIndeterminate />
              <Text mt={2} fontSize="sm" color="gray.500" textAlign="center">
                Processing PDF...
              </Text>
            </Box>
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App; 