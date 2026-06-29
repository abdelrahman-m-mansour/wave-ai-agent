# Wave AI Agent

Wave AI Agent is an advanced, cinematic web-based artificial intelligence assistant built with Next.js and React. It features a highly interactive and visually stunning chat interface designed to provide a premium user experience.

## Features

- **Multi-Model Intelligence**: Powered by OpenAI and Groq using the Vercel AI SDK for fast and intelligent responses.
- **Dynamic User Profiles**: Create and manage personalized user profiles with secure PIN authentication, custom avatars, and dedicated chat histories.
- **Rich Media Widgets**: 
  - **Image Generation Visualization**: Integrated handling of AI-generated images with lightbox viewing and high-quality downloads.
  - **Live Weather Data**: Beautiful, real-time weather widgets displaying temperature and wind speed.
  - **Knowledge Extraction**: Smart Wikipedia widgets that pull contextual information directly into the chat stream.
- **Session Management**: Maintain multiple conversation threads per user, stored locally for privacy and quick access.
- **Cinematic User Interface**: A dynamic, responsive design featuring looping background video, glassmorphism elements, and smooth micro-animations built with Tailwind CSS.

## Tech Stack

- **Framework**: Next.js, React
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Vercel AI SDK, OpenAI, Groq

## Getting Started

### Prerequisites

Ensure you have Node.js and npm (or yarn/pnpm) installed on your machine.

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd wave-ai-agent
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables. Create a `.env.local` file in the root directory and add your API keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   ```

### Running the Development Server

Start the application locally by running:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:3000` to interact with Wave AI Agent.

## Project Structure

- `/app`: Contains the Next.js application routes, including the main chat interface.
- `/public`: Houses static assets like background videos and application icons.
- `package.json`: Defines project dependencies and scripts.
- `tailwind.config.ts`: Configuration for Tailwind CSS styling.

## License

This project is licensed under the ISC License.
