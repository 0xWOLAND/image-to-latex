import { useState, useCallback } from 'react';
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
} from '@chakra-ui/react';
import { AddIcon, CloseIcon } from '@chakra-ui/icons';

function App() {
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreview, setImagePreview] = useState([]);
  const [latexResult, setLatexResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
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
        setProgress((i + 1) * (80 / selectedImages.length)); // Use 80% for individual conversions
      }

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
        setLatexResult(data.combinedLatex);
      } else {
        setLatexResult(latexResults[0]);
      }

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
          <Heading>Image to LaTeX Converter</Heading>
          <Text>Upload images to convert them to LaTeX code</Text>

          <Box
            borderWidth={2}
            borderRadius="lg"
            borderStyle="dashed"
            borderColor={isDragging ? "blue.500" : "gray.200"}
            p={8}
            w="full"
            textAlign="center"
            position="relative"
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            transition="all 0.2s"
            bg={isDragging ? "blue.50" : "transparent"}
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
                    <Button
                      position="absolute"
                      top={2}
                      right={2}
                      size="xs"
                      colorScheme="red"
                      onClick={() => removeImage(index)}
                    >
                      <CloseIcon />
                    </Button>
                  </Box>
                ))}
              </SimpleGrid>
            )}

            <VStack spacing={4}>
              <label htmlFor="image-upload">
                <Button
                  as="span"
                  leftIcon={<AddIcon />}
                  colorScheme="blue"
                  cursor="pointer"
                  size="sm"
                >
                  {imagePreview.length === 0 ? 'Select Images' : 'Add More Images'}
                </Button>
              </label>

              {imagePreview.length > 0 && (
                <Button
                  leftIcon={<CloseIcon />}
                  colorScheme="red"
                  variant="outline"
                  onClick={clearImages}
                  size="sm"
                >
                  Clear All Images
                </Button>
              )}
              
              <Text fontSize="sm" color="gray.500">
                or drag and drop your images here
              </Text>
            </VStack>
          </Box>

          <Button
            colorScheme="green"
            isLoading={isLoading}
            onClick={handleSubmit}
            w="full"
            isDisabled={selectedImages.length === 0}
          >
            Convert to LaTeX
          </Button>

          {isLoading && (
            <Box w="full">
              <Progress value={progress} size="sm" colorScheme="green" />
              <Text mt={2} fontSize="sm" color="gray.500" textAlign="center">
                Converting images... {Math.round(progress)}%
              </Text>
            </Box>
          )}

          {latexResult && (
            <Box w="full">
              <Text mb={2} fontWeight="bold">
                LaTeX Code:
              </Text>
              <Textarea
                value={latexResult}
                isReadOnly
                minH="200px"
                fontFamily="mono"
              />
              <Button
                mt={2}
                size="sm"
                onClick={() => navigator.clipboard.writeText(latexResult)}
              >
                Copy to Clipboard
              </Button>
            </Box>
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App; 