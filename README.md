# Image to LaTeX Converter

A web application that converts images containing mathematical equations, diagrams, and text into LaTeX code. The application supports both single and multiple image uploads, PDF uploads, and provides real-time conversion progress feedback.

## Prerequisites

- Node.js (v14 or higher)
- pnpm
- LaTex distribution (e.g., TexLive)

## Build

1. Install dependencies
```bash
cd backend
pnpm install
cd ../frontend
pnpm install
```

2. Start the backend server
```bash
cd backend
pnpm start
```

3. Start the frontend server
```bash
cd frontend
pnpm start
```

Environment variables
```bash
XAI_API_KEY=<XAI API Key>
PORT=3001
```