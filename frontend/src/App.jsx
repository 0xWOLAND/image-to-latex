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
} from '@chakra-ui/react';
import { AddIcon, CloseIcon } from '@chakra-ui/icons';

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [latexResult, setLatexResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const toast = useToast();

  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
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
    
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, []);

  const handleSubmit = async () => {
    if (!selectedImage) {
      toast({
        title: 'No image selected',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      const data = await response.json();
      setLatexResult(data.latex);
      
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

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setLatexResult('');
  };

  return (
    <ChakraProvider>
      <Container maxW="container.xl" py={10}>
        <VStack spacing={8}>
          <Heading>Image to LaTeX Converter</Heading>
          <Text>Upload an image to convert it to LaTeX code</Text>

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
            {!imagePreview && (
              <>
                <Input
                  type="file"
                  accept="image/*"
                  display="none"
                  onChange={handleImageChange}
                  id="image-upload"
                />
                <label htmlFor="image-upload">
                  <Button
                    as="span"
                    leftIcon={<AddIcon />}
                    colorScheme="blue"
                    mb={4}
                    cursor="pointer"
                  >
                    Select Image
                  </Button>
                </label>
                
                <Text fontSize="sm" color="gray.500" mt={2}>
                  or drag and drop your image here
                </Text>
              </>
            )}

            {imagePreview && (
              <VStack spacing={4}>
                <Image
                  src={imagePreview}
                  alt="Preview"
                  maxH="300px"
                  mx="auto"
                  borderRadius="md"
                />
                <HStack spacing={4}>
                  <Input
                    type="file"
                    accept="image/*"
                    display="none"
                    onChange={handleImageChange}
                    id="image-upload"
                  />
                  <label htmlFor="image-upload">
                    <Button
                      as="span"
                      leftIcon={<AddIcon />}
                      colorScheme="blue"
                      cursor="pointer"
                      size="sm"
                    >
                      Change Image
                    </Button>
                  </label>
                  <Button
                    leftIcon={<CloseIcon />}
                    colorScheme="red"
                    variant="outline"
                    onClick={clearImage}
                    size="sm"
                  >
                    Clear Image
                  </Button>
                </HStack>
              </VStack>
            )}
          </Box>

          <Button
            colorScheme="green"
            isLoading={isLoading}
            onClick={handleSubmit}
            w="full"
            isDisabled={!selectedImage}
          >
            Convert to LaTeX
          </Button>

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