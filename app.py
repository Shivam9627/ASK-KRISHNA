import streamlit as st
from time import sleep
import qdrant_client
from qdrant_client import models
from llama_index.core import ChatPromptTemplate
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.llms.groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

@st.cache_resource
def initialize_models():
    embed_model = FastEmbedEmbedding(model_name="thenlper/gte-large")
    llm = Groq(model="deepseek-r1-distill-llama-70b")
    client = qdrant_client.QdrantClient(
       url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
        prefer_grpc=True
    )
    return embed_model, llm, client

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

def search(query, client, embed_model, k=5):
    collection_name = "bhagavad-gita"
    
    # Add retry mechanism for embedding generation
    max_retries = 3
    retry_delay = 2  # seconds
    
    # Try to get query embedding with retries
    for attempt in range(max_retries):
        try:
            query_embedding = embed_model.get_query_embedding(query)
            break
        except Exception as e:
            print(f"Error generating embedding (attempt {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay)
            else:
                print("Failed to generate embedding after all retries")
                # Return empty result
                from qdrant_client import models
                return models.QueryResponse(points=[])
    
    # Try to query Qdrant with retries
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
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay)
            else:
                print("Failed to query vector database after all retries")
                # Return empty result
                from qdrant_client import models
                return models.QueryResponse(points=[])

def pipeline(query, embed_model, llm, client):
    # Detect if query is in Hindi
    import re
    has_hindi = bool(re.search(r'[ऀ-ॿ]', query))
    
    # R - Retriever
    try:
        relevant_documents = search(query, client, embed_model)
        if relevant_documents and hasattr(relevant_documents, 'points') and len(relevant_documents.points) > 0:
            context = [doc.payload['context'] for doc in relevant_documents.points]
            context = "\n".join(context)
        else:
            # Handle case where no relevant documents are found
            context = "No specific context found in the Bhagavad Gita. Providing a general answer based on Krishna's teachings."
    except Exception as e:
        print(f"Error in retrieval: {e}")
        # Fallback context if retrieval fails
        context = "Unable to retrieve specific context. Providing a general answer based on Krishna's teachings."

    # A - Augment
    chat_template = ChatPromptTemplate(message_templates=message_templates)
    
    # Modify template based on language
    formatted_template = chat_template.format(
        context_str=context,
        query=query
    )
    
    # If query has Hindi characters, add instruction to respond in Hindi
    if has_hindi:
        formatted_template += "\n\nकृपया इस प्रश्न का उत्तर हिंदी में दें।"

    # G - Generate with retry mechanism
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            response = llm.complete(formatted_template)
            return response
        except Exception as e:
            print(f"LLM generation error (attempt {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay)
            else:
                # Return a fallback response if all retries fail
                return "I apologize, but I'm having trouble generating a response right now. Please try again later."


def extract_thinking_and_answer(response_text):
    """Extract thinking process and final answer from response"""
    try:
        # Handle both string and object responses
        if not isinstance(response_text, str):
            # If it's an object with a text attribute, use that
            if hasattr(response_text, 'text'):
                response_text = response_text.text
            else:
                # Otherwise convert to string
                response_text = str(response_text)
                
        thinking = response_text[response_text.find("<think>") + 7:response_text.find("</think>")].strip()
        answer = response_text[response_text.find("</think>") + 8:].strip()
        
        # Clean up Hindi text by removing unwanted symbols
        import re
        answer = re.sub(r'[\[\]]', '', answer)
        
        # Improve formatting for both Hindi and English text
        answer = re.sub(r'\n{3,}', '\n\n', answer).strip()
        
        return thinking, answer
    except Exception as e:
        print(f"Error extracting thinking and answer: {e}")
        # Return original response as fallback
        if hasattr(response_text, 'text'):
            return "", response_text.text
        return "", response_text

def main():
    st.title("🕉️ ASK KRISHNA 🪈🦚🪷")
    embed_model, llm, client = initialize_models() # this will run only once, and be saved inside the cache
    
    if "messages" not in st.session_state:
        st.session_state.messages = []

    with st.sidebar:
        if st.button("Clear Chat"):
            st.session_state.messages = []
            st.rerun()

    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant":
                thinking, answer = extract_thinking_and_answer(message["content"])
                with st.expander("Show thinking process"):
                    st.markdown(thinking)
                st.markdown(answer)
            else:
                st.markdown(message["content"])

    # Chat input
    if prompt := st.chat_input("Ask your question about the Bhagavad Gita..."):
        # Display user message
        st.chat_message("user").markdown(prompt)
        st.session_state.messages.append({"role": "user", "content": prompt})

        # Generate and display response
        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            with st.spinner("Thinking..."):
                full_response = pipeline(prompt, embed_model, llm, client)
                thinking, answer = extract_thinking_and_answer(full_response.text)
                
                with st.expander("Show thinking process"):
                    st.markdown(thinking)
                
                response = ""
                for chunk in answer.split():
                    response += chunk + " "
                    message_placeholder.markdown(response + "▌")
                    sleep(0.05)
                
                message_placeholder.markdown(answer)
                
        # Add assistant response to history
        st.session_state.messages.append({"role": "assistant", "content": full_response.text})

if __name__ == "__main__":
    main()
