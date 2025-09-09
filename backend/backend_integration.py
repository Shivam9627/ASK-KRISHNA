import os
import json
import time
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import pymongo
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import ast
from qdrant_client import QdrantClient, models
from llama_index.core import ChatPromptTemplate, SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.llms.groq import Groq
from llama_index.vector_stores.qdrant import QdrantVectorStore
import psutil
import random

# Load environment variables
load_dotenv()

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in the environment variables or .env file.")
safe_uri = MONGO_URI
if "://" in MONGO_URI:
    protocol, rest = MONGO_URI.split("://", 1)
    if "@" in rest:
        user_pass, host = rest.split("@", 1)
        safe_uri = f"{protocol}://[REDACTED]@{host}"
print(f"Connecting to MongoDB with URI: {safe_uri}")
try:
    client = pymongo.MongoClient(MONGO_URI)
    db = client["bhagavad_gita_assistant"]
    users_collection = db['users']
    chat_history_collection = db['chat_history']
    client.admin.command('ping')
    print("✅ MongoDB connection successful!")
    db.list_collection_names()
    print("✅ Database access successful!")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    raise

# Flask setup
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "https://*.vercel.app"])
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per day", "10 per hour"],
    storage_uri="memory://"
)

# Initialize models
embed_model, llm, qdrant_client, index = None, None, None, None

def initialize_models():
    global embed_model, llm, qdrant_client, index
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print("🔍 Initializing embedding model...")
            embed_model = FastEmbedEmbedding(model_name="thenlper/gte-small")
            print("✅ Embedding model initialized")
            
            print("🔍 Initializing Groq LLM...")
            llm = Groq(model="mixtral-8x7b-32768")
            print("✅ Groq LLM initialized")
            
            print("🔍 Initializing Qdrant client...")
            qdrant_client = QdrantClient(
                url=os.getenv("QDRANT_URL"),
                api_key=os.getenv("QDRANT_API_KEY"),
                prefer_grpc=True
            )
            print("✅ Qdrant client initialized")
            
            print("🔍 Loading documents and creating index...")
            documents = SimpleDirectoryReader(input_files=["../Bhagavad-gita.pdf"]).load_data()
            vector_store = QdrantVectorStore(client=qdrant_client, collection_name="bhagavad-gita")
            index = VectorStoreIndex.from_documents(documents, vector_store=vector_store, embed_model=embed_model)
            print("✅ Document index created")
            return
        except Exception as e:
            print(f"Attempt {attempt+1}/{max_retries} failed: {e}")
            if attempt == max_retries - 1:
                raise
            time.sleep(2)

# Email configuration
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM") or SMTP_USERNAME
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

def send_email(recipient_email: str, subject: str, body_text: str) -> None:
    if not all([SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, EMAIL_FROM]):
        raise RuntimeError("SMTP is not configured. Please set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, EMAIL_FROM.")
    message = MIMEMultipart()
    message["From"] = EMAIL_FROM
    message["To"] = recipient_email
    message["Subject"] = subject
    message.attach(MIMEText(body_text, "plain", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        if SMTP_USE_TLS:
            server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(EMAIL_FROM, [recipient_email], message.as_string())
        print(f"📧 Email sent to {recipient_email}")

def get_user_id_from_request():
    auth_header = request.headers.get('Authorization')
    x_user_id = request.headers.get('X-User-Id')
    print(f"🔍 Authorization header: {auth_header}")
    print(f"🔍 X-User-Id header: {x_user_id}")
    if x_user_id:
        try:
            oid = ObjectId(x_user_id)
            print(f"✅ X-User-Id parsed as ObjectId: {x_user_id}")
            return str(oid)
        except:
            if isinstance(x_user_id, str) and len(x_user_id) >= 6:
                print(f"✅ X-User-Id accepted as string: {x_user_id}")
                return x_user_id
            print(f"⚠️ Invalid X-User-Id: {x_user_id}")
    if not auth_header or not auth_header.startswith('Bearer '):
        print("⚠️ Authorization header missing or not Bearer")
        return None
    token = auth_header.split(' ')[1]
    print(f"🔐 Token (first 60 chars): {token[:60]}")
    try:
        user_data = json.loads(token)
        user_id = user_data.get('user_id')
        if user_id:
            print(f"✅ Token parsed, user_id: {user_id}")
            return user_id
        print("⚠️ Token parsed but user_id missing")
    except:
        pass
    try:
        data = ast.literal_eval(token)
        if isinstance(data, dict) and 'user_id' in data:
            print(f"✅ Token parsed as Python literal, user_id: {data['user_id']}")
            return data['user_id']
    except:
        pass
    try:
        oid = ObjectId(token)
        print(f"✅ Token parsed as ObjectId: {str(oid)}")
        return str(oid)
    except:
        pass
    try:
        m = re.search(r'"user_id"\s*:\s*"([0-9a-fA-F]{24})"', token)
        if m:
            print(f"✅ Token parsed via regex, user_id: {m.group(1)}")
            return m.group(1)
        m2 = re.search(r'user_id\s*:\s*([0-9a-fA-F]{24})', token)
        if m2:
            print(f"✅ Token parsed via regex (alt), user_id: {m2.group(1)}")
            return m2.group(1)
    except:
        pass
    print("❌ Unable to extract user_id from Authorization token")
    return None

# Search function
def search(query, client, embed_model, k=5):
    collection_name = "bhagavad-gita"
    max_retries = 3
    retry_delay = 2
    for attempt in range(max_retries):
        try:
            query_embedding = embed_model.get_query_embedding(query)
            break
        except Exception as e:
            print(f"Error generating embedding (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return models.QueryResponse(points=[])
            time.sleep(retry_delay)
    for attempt in range(max_retries):
        try:
            result = client.query_points(
                collection_name=collection_name,
                query=query_embedding,
                limit=k
            )
            return result
        except Exception as e:
            print(f"Error querying vector database (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return models.QueryResponse(points=[])
            time.sleep(retry_delay)

# Pipeline function
message_templates = [
    ChatMessage(
        content="""
        You are an expert ancient assistant who is well versed in Bhagavad-gita.
        You are Multilingual, you understand English, Hindi and Sanskrit.
        
        Always structure your response in this format:
        <think>
        [Your step-by-step thinking process here]
        </think>
        
        [Your final answer here]
        """,
        role=MessageRole.SYSTEM),
    ChatMessage(
        content="""
        We have provided context information below.
        {context_str}
        ---------------------
        Given this information, please answer the question: {query}
        ---------------------
        If the question is not from the provided context, say `I don't know. Not enough information received.`
        """,
        role=MessageRole.USER,
    ),
]

def pipeline(query, embed_model, llm, client):
    has_hindi = bool(re.search(r'[ऀ-ॿ]', query))
    max_retries = 3
    retry_delay = 2
    for attempt in range(max_retries):
        try:
            relevant_documents = search(query, client, embed_model)
            if relevant_documents and hasattr(relevant_documents, 'points') and len(relevant_documents.points) > 0:
                context = [doc.payload['context'] for doc in relevant_documents.points]
                context = "\n".join(context)
            else:
                context = "No specific context found in the Bhagavad Gita. Providing a general answer based on Krishna's teachings."
            break
        except Exception as e:
            print(f"Error in retrieval (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                context = "Unable to retrieve specific context. Providing a general answer based on Krishna's teachings."
            time.sleep(retry_delay)
    chat_template = ChatPromptTemplate(message_templates=message_templates)
    formatted_template = chat_template.format(context_str=context, query=query)
    if has_hindi:
        formatted_template += "\n\nकृपया इस प्रश्न का उत्तर हिंदी में दें।"
    for attempt in range(max_retries):
        try:
            response = llm.complete(formatted_template)
            return response
        except Exception as e:
            print(f"LLM generation error (attempt {attempt+1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return "I apologize, but I'm having trouble generating a response right now. Please try again later."
            time.sleep(retry_delay)

# Extract thinking and answer
def extract_thinking_and_answer(response_text):
    try:
        if not isinstance(response_text, str):
            response_text = str(response_text.text if hasattr(response_text, 'text') else response_text)
        thinking = response_text[response_text.find("<think>") + 7:response_text.find("</think>")].strip()
        answer = response_text[response_text.find("</think>") + 8:].strip()
        answer = re.sub(r'[\[\]]', '', answer)
        answer = re.sub(r'\n{3,}', '\n\n', answer).strip()
        return thinking, answer
    except Exception as e:
        print(f"Error extracting thinking and answer: {e}")
        return "", str(response_text.text if hasattr(response_text, 'text') else response_text)

# Routes
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "ASK KRISHNA - AI-Powered Bhagavad Gita Assistant",
        "author": "Shivam Kumar",
        "tech": "Flask, MongoDB, Qdrant, Groq LLM, React, Vercel",
        "status": "live",
        "github": "https://github.com/Shivam9627/ASK-KRISHNA",
        "portfolio": "[Your Portfolio/LinkedIn URL]"
    }), 200

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "message": "pong",
        "status": "healthy"
    }), 200

@app.route('/health', methods=['GET'])
def health():
    try:
        client.admin.command('ping')
        memory = psutil.virtual_memory()
        return jsonify({
            "status": "healthy",
            "mongodb": "connected",
            "memory_used_mb": memory.used / 1024**2,
            "memory_total_mb": memory.total / 1024**2
        })
    except:
        return jsonify({
            "status": "unhealthy",
            "mongodb": "disconnected"
        }), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup_old_chats():
    try:
        threshold = time.time() - (30 * 24 * 3600)
        result = chat_history_collection.delete_many({"created_at": {"$lt": threshold}})
        return jsonify({"deleted": result.deleted_count})
    except Exception as e:
        print(f"❌ Error cleaning up chats: {e}")
        return jsonify({'error': 'Internal server error'}), 500

def get_cached_response(prompt, user_id):
    try:
        cache = chat_history_collection.find_one({"user_id": user_id, "messages.0.content": prompt})
        if cache:
            return cache["messages"][1]["content"]
        return None
    except Exception as e:
        print(f"❌ Error checking cache: {e}")
        return None

@app.route('/api/chat', methods=['POST'])
@limiter.limit("5 per minute")
def chat():
    global embed_model, llm, qdrant_client, index
    data = request.json
    prompt = data.get('prompt')
    language = data.get('language', 'english')
    user_id = get_user_id_from_request()
    if not user_id:
        print("❌ Authentication failed: No user_id extracted")
        return jsonify({'error': 'Authentication Error: You do not have permission to access this resource. Please check your credentials.'}), 401
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    try:
        cached_response = get_cached_response(prompt, user_id)
        if cached_response:
            print(f"✅ Cache hit for prompt: {prompt}")
            return jsonify({'response': cached_response, 'thinking': ''})
        if embed_model is None or llm is None or qdrant_client is None or index is None:
            initialize_models()
        has_hindi = bool(re.search(r'[ऀ-ॿ]', prompt))
        if language == 'hindi':
            modified_prompt = f"कृपया इस प्रश्न का उत्तर हिंदी में दें, भले ही प्रश्न किसी भी भाषा में हो। कृपया शुद्ध हिंदी का प्रयोग करें और उत्तर को स्पष्ट रूप से लिखें। पूर्ण वाक्यों में उत्तर दें: {prompt}"
            if has_hindi:
                hindi_blocks = re.findall(r'[ऀ-ॿ\s\.,;:!?()]+', prompt)
                if hindi_blocks:
                    longest_hindi_block = max(hindi_blocks, key=len)
                    if len(longest_hindi_block) > len(prompt) / 3:
                        modified_prompt = f"निम्नलिखित हिंदी प्रश्न का उत्तर हिंदी में ही दें। कृपया शुद्ध हिंदी का प्रयोग करें और उत्तर को स्पष्ट रूप से लिखें। पूर्ण वाक्यों में उत्तर दें: {longest_hindi_block}"
                    else:
                        modified_prompt = f"निम्नलिखित हिंदी प्रश्न का उत्तर हिंदी में ही दें। कृपया शुद्ध हिंदी का प्रयोग करें और उत्तर को स्पष्ट रूप से लिखें। पूर्ण वाक्यों में उत्तर दें: {prompt}"
        else:
            modified_prompt = f"Please answer this question in English, regardless of the language it's asked in: {prompt}"
        max_retries = 3
        for attempt in range(max_retries):
            try:
                query_engine = index.as_query_engine(llm=llm)
                full_response = query_engine.query(modified_prompt)
                thinking, answer = extract_thinking_and_answer(full_response)
                break
            except Exception as e:
                print(f"Chat error (attempt {attempt+1}/{max_retries}): {e}")
                if attempt == max_retries - 1:
                    return jsonify({'error': 'Failed to generate response after retries'}), 500
                time.sleep(1)
        if language == 'hindi':
            answer = re.sub(r'[\[\]]', '', answer)
            hindi_blocks = re.findall(r'([ऀ-ॿ0-9\s\n\r\t\-•\.,;:!?()"""''\u0020-\u0040\u005B-\u0060\u007B-\u007E]+)', answer)
            if hindi_blocks:
                answer = max(hindi_blocks, key=len).strip()
                if len(answer) < 20 and len(answer) < len(answer) * 0.3:
                    answer = re.sub(r'[\[\]]', '', answer).strip()
            answer = re.sub(r'\n{3,}', '\n\n', answer).strip()
            answer = re.sub(r'^(Here is|The answer|Answer|Response|In Hindi|Hindi translation)[:\s]*', '', answer, flags=re.IGNORECASE)
            if answer.strip() in [',', ',,', ',,,'] or len(answer.strip()) < 5:
                answer = "क्षमा करें, मुझे आपके प्रश्न का उत्तर देने में समस्या हो रही है। कृपया अपना प्रश्न दोबारा पूछें।"
            answer = re.sub(r',{2,}', ',', answer)
            thinking = ''
        if user_id:
            chat_id = str(ObjectId())
            chat_entry = {
                '_id': ObjectId(chat_id),
                'user_id': user_id,
                'date': time.strftime('%Y-%m-%d'),
                'created_at': time.time(),
                'title': prompt[:30] + '...' if len(prompt) > 30 else prompt,
                'messages': [
                    {'role': 'user', 'content': prompt},
                    {'role': 'assistant', 'content': answer}
                ]
            }
            result = chat_history_collection.insert_one(chat_entry)
            print(f"✅ Chat saved for user {user_id} with id {result.inserted_id}")
        return jsonify({'response': answer, 'thinking': thinking})
    except Exception as e:
        print(f"Error in /api/chat: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    user_id = get_user_id_from_request()
    if not user_id:
        print("❌ No user ID found in request")
        return jsonify([])
    try:
        query = {'user_id': user_id}
        try:
            oid = ObjectId(user_id)
            query = {'$or': [{'user_id': user_id}, {'user_id': oid}]}
        except:
            pass
        cursor = chat_history_collection.find(query).sort([
            ('created_at', pymongo.DESCENDING),
            ('_id', pymongo.DESCENDING)
        ])
        chats = list(cursor)
        for chat in chats:
            chat['_id'] = str(chat['_id'])
            if 'date' not in chat and 'created_at' in chat:
                try:
                    chat['date'] = time.strftime('%Y-%m-%d', time.localtime(chat['created_at']))
                except:
                    chat['date'] = ''
        print(f"✅ Found {len(chats)} chats for user {user_id}")
        return jsonify(chats)
    except Exception as e:
        print(f"❌ Error fetching history: {e}")
        return jsonify([])

@app.route('/api/history/<chat_id>', methods=['GET'])
def get_single_chat(chat_id):
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        query = {'_id': ObjectId(chat_id), '$or': [{'user_id': user_id}]}
        try:
            query['$or'].append({'user_id': ObjectId(user_id)})
        except:
            pass
        chat = chat_history_collection.find_one(query)
        if not chat:
            return jsonify({'error': 'Not found'}), 404
        chat['_id'] = str(chat['_id'])
        return jsonify(chat)
    except Exception as e:
        print(f"❌ Error fetching single chat: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/history/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        try:
            oid = ObjectId(chat_id)
        except:
            return jsonify({'error': 'Invalid chat id'}), 400
        query = {'_id': oid, '$or': [{'user_id': user_id}]}
        try:
            query['$or'].append({'user_id': ObjectId(user_id)})
        except:
            pass
        result = chat_history_collection.delete_one(query)
        if result.deleted_count == 0:
            print(f"⚠️ Delete failed for chat {chat_id} and user {user_id}")
            return jsonify({'error': 'Not found or not owned by user'}), 404
        print(f"🗑️ Deleted chat {chat_id} for user {user_id}")
        return jsonify({'success': True})
    except Exception as e:
        print(f"❌ Error deleting chat: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/history', methods=['DELETE'])
def delete_all_history():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        query = {'$or': [{'user_id': user_id}]}
        try:
            query['$or'].append({'user_id': ObjectId(user_id)})
        except:
            pass
        result = chat_history_collection.delete_many(query)
        print(f"🧹 Deleted {result.deleted_count} chats for user {user_id}")
        return jsonify({'success': True, 'deleted': result.deleted_count})
    except Exception as e:
        print(f"❌ Error deleting all history: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password required'}), 400
    if users_collection.find_one({'$or': [{'username': username}, {'email': email}]}):
        return jsonify({'error': 'Username or email already exists'}), 400
    otp_collection = db['otp_codes']
    verified_email = otp_collection.find_one({
        'email': email,
        'type': 'registration',
        'verified': True
    })
    if not verified_email:
        return jsonify({'error': 'Email not verified. Please verify your email with OTP first.'}), 400
    user_data = {
        'username': username,
        'email': email,
        'password': password,
        'created_at': time.time(),
        'profileImage': None
    }
    result = users_collection.insert_one(user_data)
    otp_collection.delete_many({'email': email, 'type': 'registration'})
    token_data = {
        'user_id': str(result.inserted_id),
        'username': username,
        'email': email,
        'created_at': user_data['created_at'],
        'profileImage': None
    }
    return jsonify({
        'success': True,
        'user_id': str(result.inserted_id),
        'username': username,
        'email': email,
        'created_at': user_data['created_at'],
        'profileImage': None,
        'token': json.dumps(token_data)
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    print(f"🔍 Login attempt - Email: {email}")
    if not email or not password:
        print("❌ Missing email or password")
        return jsonify({'error': 'Email and password required'}), 400
    user = users_collection.find_one({'email': email, 'password': password})
    print(f"🔍 User found: {user is not None}")
    if not user:
        print(f"❌ Login failed for email: {email}")
        return jsonify({'error': 'Invalid credentials'}), 401
    token_data = {
        'user_id': str(user['_id']),
        'username': user['username'],
        'email': user['email'],
        'created_at': user.get('created_at'),
        'profileImage': user.get('profileImage')
    }
    print(f"✅ Login successful for user: {user['username']}")
    return jsonify({
        'success': True,
        'user_id': str(user['_id']),
        'username': user['username'],
        'email': user['email'],
        'created_at': user.get('created_at'),
        'profileImage': user.get('profileImage'),
        'token': json.dumps(token_data)
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    return jsonify({'success': True})

@app.route('/api/auth/profile', methods=['GET'])
def get_profile():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'user_id': str(user['_id']),
            'username': user['username'],
            'email': user['email'],
            'created_at': user.get('created_at'),
            'profileImage': user.get('profileImage')
        })
    except Exception as e:
        print(f"❌ Error fetching profile: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    username = data.get('username')
    profile_image = data.get('profileImage')
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    try:
        existing_user = users_collection.find_one({
            'username': username,
            '_id': {'$ne': ObjectId(user_id)}
        })
        if existing_user:
            return jsonify({'error': 'Username already taken'}), 400
        update_data = {'username': username}
        if profile_image:
            update_data['profileImage'] = profile_image
        result = users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'User not found'}), 404
        updated_user = users_collection.find_one({'_id': ObjectId(user_id)})
        token_data = {
            'user_id': str(updated_user['_id']),
            'username': updated_user['username'],
            'email': updated_user['email'],
            'created_at': updated_user.get('created_at'),
            'profileImage': updated_user.get('profileImage')
        }
        return jsonify({
            'success': True,
            'user_id': str(updated_user['_id']),
            'username': updated_user['username'],
            'email': updated_user['email'],
            'created_at': updated_user.get('created_at'),
            'profileImage': updated_user.get('profileImage'),
            'token': json.dumps(token_data)
        })
    except Exception as e:
        print(f"❌ Error updating profile: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/send-registration-otp', methods=['POST'])
def send_registration_otp():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    try:
        existing_user = users_collection.find_one({'email': email})
        if existing_user:
            return jsonify({'error': 'User already exists with this email'}), 400
        otp = str(random.randint(100000, 999999))
        otp_collection = db['otp_codes']
        otp_collection.update_one(
            {'email': email, 'type': 'registration'},
            {'$set': {'otp': otp, 'created_at': time.time()}},
            upsert=True
        )
        try:
            send_email(
                recipient_email=email,
                subject="Your ASK KRISHNA registration OTP",
                body_text=f"Your OTP is: {otp}\nThis code will expire in 5 minutes."
            )
            print(f"📧 Registration OTP sent to {email}")
        except Exception as mail_err:
            print(f"⚠️ SMTP not configured or failed ({mail_err}); printing OTP to console.")
            print(f"📧 Registration OTP for {email}: {otp}")
        return jsonify({
            'success': True,
            'message': 'OTP sent to your email'
        })
    except Exception as e:
        print(f"❌ Error sending registration OTP: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/verify-registration-otp', methods=['POST'])
def verify_registration_otp():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    if not email or not otp:
        return jsonify({'error': 'Email and OTP are required'}), 400
    try:
        otp_collection = db['otp_codes']
        stored_otp = otp_collection.find_one({
            'email': email,
            'type': 'registration',
            'otp': otp
        })
        if not stored_otp:
            return jsonify({'error': 'Invalid OTP'}), 400
        if time.time() - stored_otp['created_at'] > 300:
            return jsonify({'error': 'OTP expired'}), 400
        otp_collection.update_one(
            {'email': email, 'type': 'registration'},
            {'$set': {'verified': True}}
        )
        return jsonify({
            'success': True,
            'message': 'Email verified successfully'
        })
    except Exception as e:
        print(f"❌ Error verifying registration OTP: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/send-delete-otp', methods=['POST'])
def send_delete_otp():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        email = user['email']
        otp = str(random.randint(100000, 999999))
        otp_collection = db['otp_codes']
        otp_collection.update_one(
            {'email': email, 'type': 'delete_account'},
            {'$set': {'otp': otp, 'created_at': time.time()}},
            upsert=True
        )
        try:
            send_email(
                recipient_email=email,
                subject="Confirm account deletion - OTP",
                body_text=f"Your OTP to confirm deletion is: {otp}\nThis code will expire in 5 minutes."
            )
            print(f"📧 Delete account OTP sent to {email}")
        except Exception as mail_err:
            print(f"⚠️ SMTP not configured or failed ({mail_err}); printing OTP to console.")
            print(f"📧 Delete account OTP for {email}: {otp}")
        return jsonify({
            'success': True,
            'message': 'OTP sent to your email'
        })
    except Exception as e:
        print(f"❌ Error sending delete OTP: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/account', methods=['DELETE'])
def delete_account():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    otp = data.get('otp')
    if not otp:
        return jsonify({'error': 'OTP is required'}), 400
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        email = user['email']
        otp_collection = db['otp_codes']
        stored_otp = otp_collection.find_one({
            'email': email,
            'type': 'delete_account',
            'otp': otp
        })
        if not stored_otp:
            return jsonify({'error': 'Invalid OTP'}), 400
        if time.time() - stored_otp['created_at'] > 300:
            return jsonify({'error': 'OTP expired'}), 400
        users_collection.delete_one({'_id': ObjectId(user_id)})
        chat_history_collection.delete_many({'user_id': user_id})
        otp_collection.delete_many({'email': email})
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        })
    except Exception as e:
        print(f"❌ Error deleting account: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/test', methods=['GET'])
def test_connection():
    try:
        client.admin.command('ping')
        users_count = users_collection.count_documents({})
        chats_count = chat_history_collection.count_documents({})
        return jsonify({
            'status': 'success',
            'database': 'connected',
            'users_count': users_count,
            'chats_count': chats_count,
            'collections': db.list_collection_names()
        })
    except Exception as e:
        print(f"❌ Test connection failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/api/test/create-user', methods=['POST'])
def create_test_user():
    try:
        test_user = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'password123',
            'created_at': time.time()
        }
        existing_user = users_collection.find_one({'email': test_user['email']})
        if existing_user:
            return jsonify({
                'message': 'Test user already exists',
                'user': {
                    'username': existing_user['username'],
                    'email': existing_user['email'],
                    'id': str(existing_user['_id'])
                }
            })
        result = users_collection.insert_one(test_user)
        return jsonify({
            'message': 'Test user created successfully',
            'user': {
                'username': test_user['username'],
                'email': test_user['email'],
                'id': str(result.inserted_id)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test/users', methods=['GET'])
def list_users():
    try:
        users = list(users_collection.find({}, {'password': 0}))
        for user in users:
            user['_id'] = str(user['_id'])
        return jsonify({
            'users': users,
            'count': len(users)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)