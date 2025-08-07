# 🕉️ ASK KRISHNA - Bhagavad Gita Assistant

A full-stack application featuring a React frontend and Streamlit+Flask backend that helps users understand and explore the teachings of the Bhagavad Gita. The assistant can comprehend and respond in multiple languages including English and Hindi, powered by Deepseek R1 and LlamaIndex.

<img width="575" alt="Screenshot 2025-01-29 at 04 23 33" src="https://github.com/user-attachments/assets/73e0f930-7b7f-4b37-826c-a49ac06d9fdc" />

## 🌟 Features

- **Modern React Frontend**: Responsive UI with authentication, chat history, and multilingual support
- **Powerful Backend**: Streamlit for the core AI functionality and Flask for API integration
- **Multilingual Support**: English and Hindi responses
- **User Authentication**: Register, login, and personalized experience
- **Chat History**: Save and retrieve past conversations
- **Question Limit**: Free tier with limited questions, unlimited for registered users
- **Context-aware Responses**: Using RAG (Retrieval Augmented Generation)
- **High-performance Vector Search**: Qdrant with Binary Quantization and FastEmbed
- **Advanced LLM**: Powered by the Deepseek-R1 model via Groq for faster responses
- **Retrieval Pipeline**: Using LlamaIndex core 
- **Database Integration**: MongoDB for user data and chat history storage

## 🛠️ Technical Stack

### Frontend
- **Framework**: React.js
- **Routing**: React Router
- **State Management**: Context API
- **HTTP Client**: Axios
- **UI Components**: React Icons, React Markdown

### Backend
- **API Server**: Flask with Flask-CORS
- **AI Application**: Streamlit
- **Database**: MongoDB Atlas
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
- Node.js and npm
- Groq API Key
- Qdrant Cloud Account (or local installation)
- MongoDB Atlas Account
- Access to the Bhagavad Gita source documents

## ⚡ Installation

### Backend Setup

1. Install the required Python packages:
```bash
cd backend
pip install -r requirements.txt
```

2. Create a `.env` file in the root directory with your API keys:
```
GROQ_API_KEY=your-groq-api-key
QDRANT_URL=your-qdrant-url
QDRANT_API_KEY=your-qdrant-api-key
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install the required npm packages:
```bash
npm install
```

## 🚀 Running the Application

### Start the Backend

1. Run the integrated backend (Flask + Streamlit):
```bash
cd backend
python backend_integration.py
```

This will start both the Flask API server on port 5000 and the Streamlit app on port 8501.

### Start the Frontend

1. In a new terminal, start the React development server:
```bash
cd frontend
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

## 📁 Project Structure

```
├── .env                  # Environment variables
├── app.py                # Streamlit RAG pipeline
├── backend/              # Backend code
│   ├── backend_integration.py  # Flask API server
│   └── requirements.txt  # Backend dependencies
└── frontend/            # React frontend
    ├── public/          # Static files
    ├── src/             # Source code
    │   ├── components/  # Reusable components
    │   ├── contexts/    # Context providers
    │   ├── pages/       # Page components
    │   └── services/    # API services
    ├── package.json     # Frontend dependencies
    └── README.md        # Frontend documentation
```

## 💾 Database Structure

### MongoDB Collections

- **users**: Stores user information
  - `_id`: User ID
  - `username`: User's display name
  - `email`: User's email address
  - `password`: User's password (hashed in production)
  - `created_at`: Account creation timestamp

- **chat_history**: Stores chat conversations
  - `_id`: Chat ID
  - `user_id`: ID of the user who owns this chat
  - `date`: Date of the conversation
  - `title`: Title of the conversation (derived from the first message)
  - `messages`: Array of message objects
    - `role`: Either 'user' or 'assistant'
    - `content`: The message content

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Login a user
- `POST /api/auth/logout`: Logout a user

### Chat
- `POST /api/chat`: Send a message to the chatbot
- `GET /api/history`: Get chat history for the logged-in user
- `DELETE /api/history/:chatId`: Delete a specific chat from history

## 🎨 Customization

### Changing the Theme

You can modify the CSS files in the frontend to change the appearance of the application.

### Adding New Features

The modular structure of the application makes it easy to add new features:

1. Add new API endpoints in `backend_integration.py`
2. Create new React components in the frontend
3. Update the routes in `App.js` to include your new pages

## ❓ Troubleshooting

- If you encounter CORS issues, make sure the Flask server is running and the frontend is configured to connect to the correct URL.
- If the MongoDB connection fails, check your connection string in the `.env` file.
- If the Streamlit app doesn't start, make sure all dependencies are installed correctly.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
