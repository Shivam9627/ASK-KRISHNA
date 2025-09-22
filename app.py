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
    query_embedding = embed_model.get_query_embedding(query)
    result = client.query_points(
        collection_name=collection_name,
        query=query_embedding,
        limit=k
    )
    return result

def pipeline(query, embed_model, llm, client):
    # R - Retriever
    relevant_documents = search(query, client, embed_model)
    context = [doc.payload['context'] for doc in relevant_documents.points]
    context = "\n".join(context)

    # A - Augment
    chat_template = ChatPromptTemplate(message_templates=message_templates)

    # G - Generate
    response = llm.complete(
        chat_template.format(
            context_str=context,
            query=query)
    )
    return response

def extract_thinking_and_answer(response_text):
    """Extract thinking process and final answer from response"""
    try:
        thinking = response_text[response_text.find("<think>") + 7:response_text.find("</think>")].strip()
        answer = response_text[response_text.find("</think>") + 8:].strip()
        return thinking, answer
    except:
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
