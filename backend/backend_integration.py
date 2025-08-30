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
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables from .env file
load_dotenv()

# Get the MongoDB URI from environment variables
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in the environment variables or .env file.")

print(f"Connecting to MongoDB with URI: {MONGO_URI}")

# Connect to MongoDB (no spaces in db name!)
client = pymongo.MongoClient(MONGO_URI)
db = client["bhagavad_gita_assistant"]  # Remove spaces from database name

# Collections
users_collection = db['users']
chat_history_collection = db['chat_history']

# Test MongoDB connection
try:
    client.admin.command('ping')
    print("✅ MongoDB connection successful!")
    db.list_collection_names()
    print("✅ Database access successful!")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    raise e

app = Flask(__name__)
CORS(app)

# --- Add this after app = Flask(__name__) and CORS(app) ---

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "ASK-KRISHNA backend is live 🚀",
        "status": "ok"
    }), 200

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({
        "message": "pong",
        "status": "healthy"
    }), 200


# Path to the Streamlit app
STREAMLIT_APP_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app.py')

# Import Streamlit app components
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import initialize_models, pipeline, extract_thinking_and_answer
import ast

# Initialize models at startup
embed_model, llm, qdrant_client = None, None, None

def init_models():
    global embed_model, llm, qdrant_client
    embed_model, llm, qdrant_client = initialize_models()

# Email configuration (optional - used for sending OTP emails)
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM") or SMTP_USERNAME
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

def send_email(recipient_email: str, subject: str, body_text: str) -> None:
    """Send an email using configured SMTP settings. Raises on failure."""
    if not (SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD and EMAIL_FROM):
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

def get_user_id_from_request():
    # Extract user ID from Authorization header
    # Prefer explicit header if present
    x_user_id = request.headers.get('X-User-Id')
    if x_user_id:
        try:
            oid = ObjectId(x_user_id)
            return str(oid)
        except Exception:
            # If it's not an ObjectId, still allow as string id
            if isinstance(x_user_id, str) and len(x_user_id) >= 6:
                return x_user_id

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("⚠️ Authorization header missing or malformed")
        return None
    
    token = auth_header.split(' ')[1]
    try:
        print(f"🔐 Received token (first 60 chars): {token[:60]}")
    except Exception:
        pass
    try:
        # Parse the token (which contains user data from localStorage)
        user_data = json.loads(token)
        user_id = user_data.get('user_id')
        if user_id:
            return user_id
        print("⚠️ Token parsed but user_id missing")
    except Exception as e:
        print(f"Error parsing token as JSON: {e}")

    # Try Python literal dict (e.g., single-quoted)
    try:
        data = ast.literal_eval(token)
        if isinstance(data, dict) and 'user_id' in data:
            return data['user_id']
    except Exception as e:
        print(f"Error parsing token as Python literal: {e}")

    # If token looks like a Mongo ObjectId, accept as user_id directly
    try:
        oid = ObjectId(token)
        return str(oid)
    except Exception:
        pass

    # Sometimes token may be a JSON string wrapped in extra quotes
    if token.startswith('"') and token.endswith('"'):
        try:
            inner = token.strip('"')
            data = json.loads(inner)
            if isinstance(data, dict) and 'user_id' in data:
                return data['user_id']
        except Exception as e:
            print(f"Error parsing re-quoted token: {e}")

    # Try regex extraction for user_id in malformed tokens
    try:
        import re
        m = re.search(r'"user_id"\s*:\s*"([0-9a-fA-F]{24})"', token)
        if m:
            return m.group(1)
        m2 = re.search(r'user_id\s*:\s*([0-9a-fA-F]{24})', token)
        if m2:
            return m2.group(1)
    except Exception as e:
        print(f"Regex extraction failed: {e}")

    print("❌ Unable to extract user_id from Authorization token")
    return None

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
        if embed_model is None or llm is None or qdrant_client is None:
            init_models()

        # Always modify the prompt based on the selected language, regardless of input language
        if language == 'hindi':
            # Add instruction to respond in Hindi regardless of input language
            modified_prompt = f"कृपया इस प्रश्न का उत्तर हिंदी में दें, भले ही प्रश्न किसी भी भाषा में हो: {prompt}"
        else:
            # For English, ensure response is in English
            modified_prompt = f"Please answer this question in English, regardless of the language it's asked in: {prompt}"

        full_response = pipeline(modified_prompt, embed_model, llm, qdrant_client)
        thinking, answer = extract_thinking_and_answer(full_response.text)

        if language == 'hindi':
            import re
            # Clean up the answer by removing unwanted symbols like square brackets
            answer = re.sub(r'[\[\]]', '', answer)
            # Extract the longest Hindi text block
            hindi_blocks = re.findall(r'([ऀ-ॿ0-9\s\n\r\t\-•\.,;:!?()"""'']+)', answer)
            if hindi_blocks:
                answer = max(hindi_blocks, key=len).strip()
            answer = re.sub(r'\n{3,}', '\n\n', answer).strip()
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
        else:
            print("ℹ️ No user_id in request; responding without saving history")

        return jsonify({'response': answer, 'thinking': thinking})

    except Exception as e:
        print("Error in /api/chat:", e)
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    user_id = get_user_id_from_request()
    if not user_id:
        print("❌ No user ID found in request")
        return jsonify([])

    try:
        # Build query matching string user_id and tolerate legacy ObjectId user_id
        query = {'user_id': user_id}
        try:
            oid = ObjectId(user_id)
            query = {'$or': [{'user_id': user_id}, {'user_id': oid}]}
        except Exception:
            pass

        cursor = chat_history_collection.find(query).sort([
            ('created_at', pymongo.DESCENDING),
            ('_id', pymongo.DESCENDING)
        ])
        chats = list(cursor)
        for chat in chats:
            chat['_id'] = str(chat['_id'])
            # Ensure consistent keys for frontend
            if 'date' not in chat and 'created_at' in chat:
                try:
                    chat['date'] = time.strftime('%Y-%m-%d', time.localtime(chat['created_at']))
                except Exception:
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
        except Exception:
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
        except Exception:
            return jsonify({'error': 'Invalid chat id'}), 400

        query = {'_id': oid, '$or': [{'user_id': user_id}]}
        try:
            query['$or'].append({'user_id': ObjectId(user_id)})
        except Exception:
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
        # Delete both string and legacy ObjectId user_id records
        query = {'$or': [{'user_id': user_id}]}
        try:
            query['$or'].append({'user_id': ObjectId(user_id)})
        except Exception:
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
    
    # Check if user already exists
    if users_collection.find_one({'$or': [{'username': username}, {'email': email}]}):
        return jsonify({'error': 'Username or email already exists'}), 400
    
    # Check if email is verified
    otp_collection = db['otp_codes']
    verified_email = otp_collection.find_one({
        'email': email,
        'type': 'registration',
        'verified': True
    })
    
    if not verified_email:
        return jsonify({'error': 'Email not verified. Please verify your email with OTP first.'}), 400
    
    # Create new user
    user_data = {
        'username': username,
        'email': email,
        'password': password,  # In production, hash this password
        'created_at': time.time(),
        'profileImage': None
    }
    
    result = users_collection.insert_one(user_data)
    
    # Clean up OTP data
    otp_collection.delete_many({'email': email, 'type': 'registration'})
    
    # Return user data with token
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
    print(f"📝 Request data: {data}")
    
    if not email or not password:
        print("❌ Missing email or password")
        return jsonify({'error': 'Email and password required'}), 400
    
    # Find user by email
    user = users_collection.find_one({'email': email, 'password': password})
    
    print(f"🔍 User found: {user is not None}")
    if user:
        print(f"✅ User details: {user}")
    
    if not user:
        print(f"❌ Login failed for email: {email}")
        # Let's also check if the user exists with different password
        user_exists = users_collection.find_one({'email': email})
        if user_exists:
            print(f"⚠️ User exists but password is wrong")
            print(f"⚠️ Stored password: {user_exists.get('password')}")
            print(f"⚠️ Provided password: {password}")
        else:
            print(f"⚠️ User with email {email} does not exist")
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create token data
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
    # In a real implementation, you might invalidate the token
    return jsonify({'success': True})

# Profile management endpoints
@app.route('/api/auth/profile', methods=['GET'])
def get_profile():
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        user_response = {
            'user_id': str(user['_id']),
            'username': user['username'],
            'email': user['email'],
            'created_at': user.get('created_at'),
            'profileImage': user.get('profileImage')
        }
        return jsonify(user_response)
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
        # Check if username is already taken by another user
        existing_user = users_collection.find_one({
            'username': username,
            '_id': {'$ne': ObjectId(user_id)}
        })
        
        if existing_user:
            return jsonify({'error': 'Username already taken'}), 400
        
        # Update user profile
        update_data = {'username': username}
        if profile_image:
            update_data['profileImage'] = profile_image
        
        result = users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'User not found'}), 404
        
        # Get updated user data
        updated_user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        # Create token data
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

# OTP endpoints
@app.route('/api/auth/send-registration-otp', methods=['POST'])
def send_registration_otp():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    try:
        # Check if user already exists
        existing_user = users_collection.find_one({'email': email})
        if existing_user:
            return jsonify({'error': 'User already exists with this email'}), 400
        
        # Generate OTP (6 digits)
        import random
        otp = str(random.randint(100000, 999999))
        
        # Store OTP in database (in production, use Redis or similar)
        otp_collection = db['otp_codes']
        otp_collection.update_one(
            {'email': email, 'type': 'registration'},
            {'$set': {'otp': otp, 'created_at': time.time()}},
            upsert=True
        )
        
        # Try sending email; fallback to console log if SMTP not configured
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
        # Verify OTP
        otp_collection = db['otp_codes']
        stored_otp = otp_collection.find_one({
            'email': email,
            'type': 'registration',
            'otp': otp
        })
        
        if not stored_otp:
            return jsonify({'error': 'Invalid OTP'}), 400
        
        # Check if OTP is expired (5 minutes)
        if time.time() - stored_otp['created_at'] > 300:
            return jsonify({'error': 'OTP expired'}), 400
        
        # Mark email as verified
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
        # Get user email
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        email = user['email']
        
        # Generate OTP (6 digits)
        import random
        otp = str(random.randint(100000, 999999))
        
        # Store OTP in database
        otp_collection = db['otp_codes']
        otp_collection.update_one(
            {'email': email, 'type': 'delete_account'},
            {'$set': {'otp': otp, 'created_at': time.time()}},
            upsert=True
        )
        
        # Try sending email; fallback to console log if SMTP not configured
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
        # Get user email
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        email = user['email']
        
        # Verify OTP
        otp_collection = db['otp_codes']
        stored_otp = otp_collection.find_one({
            'email': email,
            'type': 'delete_account',
            'otp': otp
        })
        
        if not stored_otp:
            return jsonify({'error': 'Invalid OTP'}), 400
        
        # Check if OTP is expired (5 minutes)
        if time.time() - stored_otp['created_at'] > 300:
            return jsonify({'error': 'OTP expired'}), 400
        
        # Delete user and all their data
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

# Debug endpoints
@app.route('/api/test', methods=['GET'])
def test_connection():
    try:
        # Test database connection
        client.admin.command('ping')
        
        # Test collections
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
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/api/test/create-user', methods=['POST'])
def create_test_user():
    try:
        # Create a test user
        test_user = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'password123',
            'created_at': time.time()
        }
        
        # Check if user already exists
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
        users = list(users_collection.find({}, {'password': 0}))  # Exclude passwords
        for user in users:
            user['_id'] = str(user['_id'])
        return jsonify({
            'users': users,
            'count': len(users)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render sets $PORT automatically
    app.run(host="0.0.0.0", port=port)
