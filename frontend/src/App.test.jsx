import { describe, it, expect, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import theme from './theme';
import App from './App';

// Wrapper component for tests
const TestWrapper = ({ children }) => (
  <ChakraProvider theme={theme}>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    {children}
  </ChakraProvider>
);

describe('LaTeX to PDF Compilation', () => {
  // Ensure server is running before tests
  beforeAll(() => {
    // Check if server is running
    return fetch('http://localhost:3001/health')
      .then(response => {
        if (!response.ok) {
          throw new Error('Server is not running. Please start the server before running tests.');
        }
      });
  });

  it('successfully compiles valid LaTeX to PDF', async () => {
    const { container } = render(<App />, {
      wrapper: TestWrapper
    });
    
    const validLatex = `
      \\documentclass{article}
      \\begin{document}
      Hello, World!
      \\end{document}
    `.trim();
    
    const response = await fetch('http://localhost:3001/api/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latex: validLatex }),
    });

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.pdfUrl).toBeDefined();
    
    // Updated URL format for PDF verification
    const pdfResponse = await fetch(`http://localhost:3001${data.pdfUrl}`);
    expect(pdfResponse.ok).toBe(true);
    expect(pdfResponse.headers.get('content-type')).toBe('application/pdf');
  });

  it('handles invalid LaTeX compilation', async () => {
    render(<App />, {
      wrapper: TestWrapper
    });
    
    const invalidLatex = `
      \\documentclass{article}
      \\begin{document}
      \\invalidcommand
      \\end{document}
    `.trim();
    
    const response = await fetch('http://localhost:3001/api/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latex: invalidLatex }),
    });

    expect(response.ok).toBe(false);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
}); 