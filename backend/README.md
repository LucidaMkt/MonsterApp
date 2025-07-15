# MonsterApp AI Backend

This directory contains the Python-based backend server for the MonsterApp Chrome Extension. It uses the FastAPI framework to provide AI-powered endpoints for content generation, analysis, and more.

## Setup and Installation

Follow these steps to get the backend server running locally.

### 1. Prerequisites

- **Python 3.7+**: Make sure you have a recent version of Python installed. You can check your version by running:
  ```bash
  python --version
  ```

### 2. Create a Virtual Environment (Recommended)

It's highly recommended to use a virtual environment to manage project dependencies. This keeps your global Python installation clean.

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

With your virtual environment activated, install the required libraries from the `requirements.txt` file.

```bash
pip install -r requirements.txt
```

## Running the Server

Once the dependencies are installed, you can start the server using `uvicorn`.

```bash
# Make sure you are in the 'backend' directory and your virtual environment is active
uvicorn main:app --reload --port 8000
```

This command will:
- Start the server on `http://127.0.0.1:8000`.
- The `--reload` flag makes the server automatically restart after you make any code changes, which is very useful for development.

## API Documentation

FastAPI automatically generates interactive API documentation. Once the server is running, you can access it at:

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

This documentation allows you to see all available endpoints, their parameters, and even test them directly from your browser.
