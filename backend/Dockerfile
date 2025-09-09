FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for PyAudio and others
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    portaudio19-dev \
    libasound-dev \
    libportaudio2 \
    libportaudiocpp0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from backend folder
COPY backend/requirements.txt requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the whole project (backend + anything else)
COPY . .

# Run your Flask app with Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:8080", "backend.backend_integration:app"]
