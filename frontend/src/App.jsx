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
    console.log("Starting PDF compilation with LaTeX:", latex);
    
    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latex }),
      });

      console.log("Received response:", response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to compile PDF');
      }

      const data = await response.json();
      console.log("Compilation successful, PDF URL:", data.pdfUrl);
      const baseUrl = import.meta.env.DEV ? 'http://localhost:3001' : '';
      setPdfUrl(`${baseUrl}${data.pdfUrl}`);

      toast({
        title: 'PDF compiled successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Compilation error:", error);
      toast({
        title: 'PDF Compilation failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsCompiling(false);
      console.log("Compilation process completed");
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
                  >
                    <pre
                      style={{
                        margin: 0,
                        height: '100%',
                        padding: '16px',
                        backgroundColor: colorMode === 'dark' ? '#1A202C' : 'white',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {latexResult}
                    </pre>
                  </Box>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      mt={2}
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(latexResult)}
                      bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                      _hover={{
                        bg: colorMode === 'dark' ? 'gray.600' : 'gray.200'
                      }}
                      leftIcon={<FiCopy size={16} />}
                    >
                      Copy to Clipboard
                    </Button>
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
            w="full"
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

          {isLoading && (
            <Box w="full">
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