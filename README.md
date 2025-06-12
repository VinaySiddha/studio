# Local AI Engineering Tutor - Next.js Frontend

This project is a Next.js frontend designed to interact with a Python Flask backend, providing a user interface for an AI Engineering Tutor.

## Project Structure

- `src/`: Contains the Next.js frontend application code (components, pages, server actions, AI flows for Genkit).
- `backend/`: Contains the Python Flask backend application code (API endpoints, AI core logic, database interactions).
- `public/`: Static assets for the Next.js app.
- `.env`: Environment variables for the Next.js app (e.g., `NEXT_PUBLIC_FLASK_BACKEND_URL`).
- `package.json`: Defines Node.js dependencies and scripts for the Next.js frontend.
- `backend/requirements.txt`: Defines Python dependencies for the Flask backend.

## Prerequisites

- Node.js (v18 or newer recommended) and npm/yarn for the Next.js frontend.
- Python (v3.8 or newer recommended) and pip for the Flask backend.
- An Ollama server running with the models specified in `backend/config.py`.
- A MongoDB instance running and accessible as configured in `backend/config.py`.

## Setup

### 1. Backend (Flask) Setup

It's highly recommended to use a Python virtual environment.

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment (e.g., named 'venv')
python -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows (Git Bash or WSL):
# source venv/Scripts/activate
# On Windows (Command Prompt/PowerShell):
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Deactivate virtual environment when done (optional)
# deactivate
```

Before running the backend, ensure your `backend/config.py` (and potentially a `backend/.env` file if you create one for Flask) is configured correctly for your Ollama and MongoDB instances.

### 2. Frontend (Next.js) Setup

```bash
# Navigate to the root project directory (if not already there)
# cd .. (if you were in the 'backend' directory)

# Install Node.js dependencies
npm install
# or if you use yarn:
# yarn install
```

Create a `.env` file in the root of the Next.js project (alongside `package.json`) and add the following, adjusting the URL if your Flask backend runs on a different port:

```env
NEXT_PUBLIC_FLASK_BACKEND_URL=http://localhost:5000
```

## Running the Application

You need to run both the backend and frontend servers.

### 1. Start the Flask Backend Server

Ensure your Python virtual environment (if used) is activated.

```bash
# Navigate to the backend directory
cd backend

# Run the Flask application
python app.py
```

The Flask backend should start, typically on `http://localhost:5000`. Check the terminal output for the exact address and port.

### 2. Start the Next.js Frontend Development Server

Open a **new terminal window/tab**.

```bash
# Navigate to the root project directory
# (where package.json is located)

# Start the Next.js development server
npm run dev
# or if you use yarn:
# yarn dev
```

The Next.js frontend should start, typically on `http://localhost:9002`. Open this URL in your browser.

### 3. Start Genkit Development Server (Optional - if chat uses Genkit directly)

If the chat feature implemented in the Next.js frontend (e.g., via `/src/app/api/chat/route.ts`) uses Genkit directly for its AI interactions (rather than proxying to the Flask backend's chat capabilities), you'll also need to run the Genkit development server.

Open another **new terminal window/tab**.

```bash
# Navigate to the root project directory

# Start the Genkit development server
npm run genkit:dev
# or for watching changes:
# npm run genkit:watch
```
This typically starts the Genkit server on `http://localhost:4000` and a Dev UI on `http://localhost:4100`.

## Development

- **Frontend**: Modify files in the `src/` directory. The Next.js dev server will usually auto-reload.
- **Backend**: Modify files in the `backend/` directory. You might need to restart the Flask server for changes to take effect (especially for `app.py` or `config.py`).
- **AI Flows (Genkit)**: If using Genkit directly, modify files in `src/ai/flows/`. The `genkit:watch` script can auto-reload.

## Key Technologies

- **Frontend**: Next.js, React, TypeScript, ShadCN UI, Tailwind CSS
- **Backend**: Python, Flask
- **AI**: Ollama (via Flask backend), Genkit (potentially for some Next.js direct AI features)
- **Database**: MongoDB (via Flask backend)
