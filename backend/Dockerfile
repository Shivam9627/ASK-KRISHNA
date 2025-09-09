FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for PyAudio, ffmpeg etc.
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

# Copy requirements file (already inside backend/)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend code into container
COPY . .

# Expose Cloud Run port
EXPOSE 8080

# Start the app
CMD ["gunicorn", "-b", "0.0.0.0:8080", "backend_integration:app"]
