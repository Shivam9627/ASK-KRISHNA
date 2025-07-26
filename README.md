# 🕉️ Bhagavad-Gita-Assistant-Deepseek-R1
Qdrant Binary Quantization + Deepseek R1 + LlamaIndex Core => One hell of the application 

An intelligent conversational assistant powered by Deepseek that helps users understand and explore the teachings of the Bhagavad Gita. The assistant can comprehend and respond in multiple languages including English, Hindi, and Sanskrit.

<img width="575" alt="Screenshot 2025-01-29 at 04 23 33" src="https://github.com/user-attachments/assets/73e0f930-7b7f-4b37-826c-a49ac06d9fdc" />

## 🌟 Features

- Multilingual support (English, Hindi, Sanskrit)
- Context-aware responses using RAG (Retrieval Augmented Generation)
- High-performance indexing vector search using Qdrant with Binary Quantization and FastEmbed. 
- High-quality thinking and reasoning capability powered by the Deepseek-R1 model via Groq for faster response. 
- Retrieval pipeline using LlamaIndex core. 

## 🛠️ Technical Stack

- **LLM**: Deepseek-R1-distill-llama-70b (via Groq)
- **Vector Store**: Qdrant with Binary Quantization
- **Embeddings**: FastEmbed (Nlper GTE-large model)
- **Framework**: LlamaIndex Core

## 💡 Binary Quantization

This project leverages Qdrant's Binary Quantization (BQ) for optimal performance:

- **Performance Benefits**: 
  - Up to 40x improvement in retrieval speeds
  - Significantly reduced memory consumption
  - Excellent scalability for large vector dimensions

- **How it Works**: 
  - Converts floating point vector embeddings into binary/boolean values
  - Built on Qdrant's scalar quantization technology
  - Uses specialized SIMD CPU instructions for fast vector comparisons

- **Advantages**:
  - Handles high throughput requirements
  - Maintains low latency
  - Provides efficient indexing
  - Particularly effective for collections with large vector lengths

- **Flexibility**: 
  - Allows balancing between speed and recall accuracy at search time
  - No need to rebuild indices to adjust this tradeoff

## 📋 Prerequisites

- Python 3.x
- Groq API Key
- Qdrant Cloud Account (or local installation)
- Access to the Bhagavad Gita source documents

## ⚡ Installation

1. Install the required packages:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```python
os.environ['GROQ_API_KEY'] = 'your-groq-api-key'
```

3. Configure Qdrant client with your credentials:
```python
client = qdrant_client.QdrantClient(
    url = "your-qdrant-url",
    api_key = "your-qdrant-api-key",
    prefer_grpc=True
)
```

## 🎯 Key Components

### Vector Store Configuration
- Uses Qdrant with binary quantization for efficient storage and retrieval
- Vector size: 1024 dimensions
- Distance metric: Cosine similarity
- On-disk storage with RAM optimization

### RAG Pipeline
1. **Retrieval**: Searches for relevant passages using semantic similarity
2. **Augmentation**: Combines retrieved context with the user query
3. **Generation**: Produces responses using the Deepseek-R1 model

## 📝 Notes

- The system uses batched processing (batch size: 50) for efficient document embedding
- Binary quantization optimizes both storage footprint and query performance
- The assistant is designed to acknowledge when it doesn't have sufficient context to answer a question
- Responses are grounded in the provided Bhagavad Gita text to ensure accuracy

## 🤝 Contributing

Feel free to submit issues and enhancement requests! 

Don't forget to check out [Qdrant GitHub](https://github.com/qdrant/qdrant) ⭐️  and the amazing blog on [Binary Quantization](https://qdrant.tech/articles/binary-quantization/)
