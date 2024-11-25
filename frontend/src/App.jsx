import { useState } from 'react';
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
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [latexResult, setLatexResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

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
            p={8}
            w="full"
            textAlign="center"
          >
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
              >
                Select Image
              </Button>
            </label>

            {imagePreview && (
              <Box mt={4}>
                <Image
                  src={imagePreview}
                  alt="Preview"
                  maxH="300px"
                  mx="auto"
                  borderRadius="md"
                />
              </Box>
            )}
          </Box>

          <Button
            colorScheme="green"
            isLoading={isLoading}
            onClick={handleSubmit}
            w="full"
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