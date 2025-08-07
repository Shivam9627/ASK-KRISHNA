import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import subprocess
import sys
from dotenv import load_dotenv
import pymongo
from bson import ObjectId

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Path to the Streamlit app
STREAMLIT_APP_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app.py')

# Import Streamlit app components
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import initialize_models, pipeline, extract_thinking_and_answer

# MongoDB Connection
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    raise ValueError("MONGO_URI must be set in the .env file")
client = pymongo.MongoClient(MONGO_URI)
db = client['bhagavad_gita_assistant']
users_collection = db['users']
chat_history_collection = db['chat_history']

# Start the Streamlit app in a separate process
def start_streamlit():
    print("Starting Streamlit app...")
    subprocess.Popen(['streamlit', 'run', STREAMLIT_APP_PATH, '--server.port=8501', '--server.headless=true'])

# Initialize models at startup
embed_model, llm, qdrant_client = None, None, None

def init_models():
    global embed_model, llm, qdrant_client
    embed_model, llm, qdrant_client = initialize_models()

# Route to handle chat requests
@app.route('/api/chat', methods=['POST'])
def chat():
    global embed_model, llm, qdrant_client
    
    data = request.json
    prompt = data.get('prompt')
    language = data.get('language', 'english')
    user_id = get_user_id_from_request()
    
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    try:
        # Ensure models are initialized
        if embed_model is None or llm is None or qdrant_client is None:
            init_models()
        
        # Modify prompt based on language if needed
        if language == 'hindi':
            modified_prompt = f"कृपया हिंदी में उत्तर दें: {prompt}"
        else:
            modified_prompt = prompt
        
        # Call the actual pipeline from the Streamlit app
        full_response = pipeline(modified_prompt, embed_model, llm, qdrant_client)
        thinking, answer = extract_thinking_and_answer(full_response.text)
        
        if language == 'hindi':
            # Improved: Extract only Hindi text, preserving structure (bullets, newlines, numbers, etc.)
            import re
            # Find the largest contiguous Hindi block (with formatting)
            hindi_blocks = re.findall(r'([\u0900-\u097F0-9\s\n\r\t\-•\.,:;!?()\[\]"“”‘’]+)', answer)
            if hindi_blocks:
                # Use the largest block (most content)
                answer = max(hindi_blocks, key=len).strip()
            # Remove excessive newlines
            answer = re.sub(r'\n{3,}', '\n\n', answer).strip()
            thinking = ''  # Hide the thinking process in Hindi mode
        
        # Save to chat history if user is logged in
        if user_id:
            chat_id = str(ObjectId())
            chat_entry = {
                '_id': chat_id,
                'user_id': user_id,
                'date': time.strftime('%Y-%m-%d'),
                'title': prompt[:30] + '...' if len(prompt) > 30 else prompt,
                'messages': [
                    {'role': 'user', 'content': prompt},
                    {'role': 'assistant', 'content': full_response.text}
                ]
            }
            chat_history_collection.insert_one(chat_entry)
        
        return jsonify({
            'response': answer,
            'thinking': thinking if language != 'hindi' else '',
            'language': language
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Route to get chat history
@app.route('/api/history', methods=['GET'])
def get_history():
    user_id = get_user_id_from_request()
    
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    history = list(chat_history_collection.find({'user_id': user_id}))
    
    # Convert ObjectId to string for JSON serialization
    for chat in history:
        chat['id'] = str(chat['_id'])
        del chat['_id']
    
    return jsonify(history)

# Route to get a single chat by ID
@app.route('/api/history/<chat_id>', methods=['GET'])
def get_single_chat(chat_id):
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    chat = chat_history_collection.find_one({'_id': chat_id, 'user_id': user_id})
    if not chat:
        return jsonify({'error': 'Chat not found or unauthorized'}), 404
    chat['id'] = str(chat['_id'])
    del chat['_id']
    return jsonify(chat)

# Route to delete a chat from history
@app.route('/api/history/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    user_id = get_user_id_from_request()
    
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    
    result = chat_history_collection.delete_one({'_id': chat_id, 'user_id': user_id})
    
    if result.deleted_count == 0:
        return jsonify({'error': 'Chat not found or unauthorized'}), 404
    
    return jsonify({'success': True})

# Auth routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')  # In production, hash this password
    
    if not username or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Check if user already exists
    if users_collection.find_one({'email': email}):
        return jsonify({'error': 'User already exists'}), 409
    
    # Create a new user
    user_id = str(ObjectId())
    user = {
        '_id': user_id,
        'username': username,
        'email': email,
        'password': password,  # In production, store hashed password
        'created_at': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    
    users_collection.insert_one(user)
    
    # Generate a token (in production, use a proper JWT)
    token = f"simulated_token_{user_id}"
    
    return jsonify({
        'id': user_id,
        'username': username,
        'email': email,
        'token': token
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Missing email or password'}), 400
    
    user = users_collection.find_one({'email': email})
    if not user or user['password'] != password:  # In production, compare hashed passwords
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate a token (in production, use a proper JWT)
    token = f"simulated_token_{user['_id']}"
    
    return jsonify({
        'id': user['_id'],
        'username': user['username'],
        'email': user['email'],
        'token': token
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    # In a real implementation, you might invalidate the token
    return jsonify({'success': True})

# Helper function to get user ID from request
def get_user_id_from_request():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    # In production, validate the JWT token
    # For now, we'll extract the user ID from our simulated token
    if token.startswith('simulated_token_'):
        return token.split('_')[-1]
    
    return None

if __name__ == '__main__':
    # Initialize models
    print("Initializing models...")
    init_models()
    print("Models initialized successfully!")
    
    # Start Streamlit in a separate thread
    threading.Thread(target=start_streamlit).start()
    
    # Start Flask app
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)