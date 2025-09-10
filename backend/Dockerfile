FROM python:3.11-slim

# Install system dependencies (minimal for LlamaIndex/Flask)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy all backend code into container
COPY . .

# Copy the PDF from repo root (adjust path if needed)
COPY ../Bhagavad-gita.pdf ./Bhagavad-gita.pdf

# Expose port
EXPOSE 8080

# Run with Gunicorn
CMD ["gunicorn", "backend_integration:app", "--bind", "0.0.0.0:8080"]