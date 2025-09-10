FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Upgrade pip and install PyTorch CPU-only (separate for custom index)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir torch==2.4.1 torchvision==0.19.1 torchaudio==2.4.1 --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend code into container
COPY . .

# Expose port
EXPOSE 8080

# Run with Gunicorn (increased timeout for slow init)
CMD ["gunicorn", "backend_integration:app", "--bind", "0.0.0.0:8080", "--timeout", "120", "--workers", "2"]