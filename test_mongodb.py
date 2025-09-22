#!/usr/bin/env python3
"""
Simple MongoDB connection test script
Run this to verify your MongoDB connection and database operations
"""

import os
import json
import time
from dotenv import load_dotenv
import pymongo
from bson import ObjectId

# Load environment variables
load_dotenv()

def test_mongodb_connection():
    """Test MongoDB connection and basic operations"""
    
    # Get MongoDB URI
    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        print("❌ MONGO_URI not found in .env file")
        return False
    
    print(f"🔗 Connecting to MongoDB with URI: {MONGO_URI}")
    
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URI)
        
        # Test connection
        client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        
        # List available databases
        databases = client.list_database_names()
        print(f"📋 Available databases: {databases}")
        
        # Connect to your database
        db_name = "bhagavad_gita_assistant"
        db = client[db_name]
        print(f"📊 Connected to database: {db_name}")
        
        # List collections
        collections = db.list_collection_names()
        print(f"📁 Available collections: {collections}")
        
        # Test users collection
        users_collection = db['users']
        users_count = users_collection.count_documents({})
        print(f"👥 Users count: {users_count}")
        
        # List existing users (without passwords)
        if users_count > 0:
            users = list(users_collection.find({}, {'password': 0}))
            print("📋 Existing users:")
            for user in users:
                print(f"  - {user.get('username')} ({user.get('email')})")
        
        # Test creating a user
        test_user = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'password123',
            'created_at': time.time()
        }
        
        # Check if test user exists
        existing_user = users_collection.find_one({'email': test_user['email']})
        if existing_user:
            print(f"✅ Test user already exists: {existing_user['username']}")
        else:
            # Create test user
            result = users_collection.insert_one(test_user)
            print(f"✅ Test user created with ID: {result.inserted_id}")
        
        # Test login
        login_user = users_collection.find_one({'email': 'test@example.com', 'password': 'password123'})
        if login_user:
            print(f"✅ Login test successful for user: {login_user['username']}")
        else:
            print("❌ Login test failed")
        
        # Test chat history collection
        chat_history_collection = db['chat_history']
        chats_count = chat_history_collection.count_documents({})
        print(f"💬 Chat history count: {chats_count}")
        
        print("\n🎉 All tests passed! MongoDB is working correctly.")
        return True
        
    except Exception as e:
        print(f"❌ MongoDB test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing MongoDB Connection...")
    success = test_mongodb_connection()
    
    if success:
        print("\n✅ MongoDB is ready for your application!")
    else:
        print("\n❌ Please check your MongoDB connection and try again.")


