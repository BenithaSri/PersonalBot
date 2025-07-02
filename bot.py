import os
import logging
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
# ← updated import here:
from langchain.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains.question_answering import load_qa_chain
from langchain.schema import Document
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__, template_folder="templates")
app.secret_key = os.environ.get("SESSION_SECRET", "fallback-secret-key")
CORS(app)

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-default-key")

# Resume content and additional data (your original text)
resume_text = """
Benitha Mutesi - Front-End Developer
... (your full resume here) ...
"""

live_update = """
🟢 As of July 2, 2025:
Benitha is actively working on a resume-powered AI chatbot using LangChain, FAISS, and OpenAI. ...
"""

additional_qa = """
Q: What are Benitha's available times for interviews?
A: Most weekdays after 2 PM EST; weekends on request...
"""

# Email notification functions (your original code)
def send_availability_notification(question, user_info, date_context=""):
    # ... your existing SMTP logic ...
    gmail_email = os.environ.get('GMAIL_EMAIL')
    gmail_password = os.environ.get('GMAIL_APP_PASSWORD')
    if not gmail_email or not gmail_password:
        app.logger.warning("Gmail credentials not configured, skipping email notification")
        return False
    try:
        subject = f"Availability Inquiry from {user_info.get('name','Unknown')} - Resume Chatbot"
        body = f"""
New Availability Inquiry from Resume Chatbot

Contact Information:
- Name: {user_info.get('name','Not provided')}
- Email: {user_info.get('email','Not provided')}
- Company: {user_info.get('company','Not provided')}
- Role: {user_info.get('role','Not provided')}

Question: "{question}"

{f'Requested Timeframe: {date_context}' if date_context else ''}

Time Received: {datetime.now().strftime('%B %d, %Y at %I:%M %p EST')}
"""
        msg = MIMEText(body, 'plain')
        msg['Subject'] = subject
        msg['From'] = gmail_email
        msg['To'] = 'panchagirib@gmail.com'
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(gmail_email, gmail_password)
            server.send_message(msg)
        app.logger.info("Availability notification sent successfully")
        return True
    except Exception as e:
        app.logger.error(f"Failed to send availability notification: {e}")
        return False

def detect_availability_question(question):
    patterns = [
        r'\b(available|availability)\b',
        r'\b(interview|meeting|call)\b.*\b(when|time|date)\b',
        # ... your full list ...
    ]
    q = question.lower()
    return any(re.search(p, q, re.IGNORECASE) for p in patterns)

def extract_date_context(question):
    date_patterns = [
        r'\b(today|tomorrow)\b',
        r'\b(this|next)\s+(week|monday|tuesday)\b',
        # ... your full list ...
    ]
    matches = []
    for p in date_patterns:
        matches += re.findall(p, question, re.IGNORECASE)
    return ", ".join(matches)

# Initialize AI components
try:
    splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(resume_text)
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_texts(chunks, embedding=embeddings)
    llm = ChatOpenAI(model_name="gpt-3.5-turbo",
                     temperature=0,
                     openai_api_key=OPENAI_API_KEY)
    qa_chain = load_qa_chain(llm, chain_type="stuff")
    app.logger.info("AI components initialized successfully")
except Exception as e:
    app.logger.error(f"Failed to initialize AI components: {e}")
    vector_store = None
    qa_chain = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    question = data.get('question', '').strip()
    if not question:
        return jsonify({'error': 'Question is required'}), 400

    is_avail = detect_availability_question(question)
    date_ctx = extract_date_context(question) if is_avail else ""

    if is_avail:
        user_info = data.get('user_info', {})
        if not user_info.get('name') or not user_info.get('email'):
            return jsonify({
                'question': question,
                'answer': "Could you please provide your name and email so I can notify Benitha about your availability request?",
                'status': 'user_info_required'
            })

        send_availability_notification(question, user_info, date_ctx)

    docs = vector_store.similarity_search(question, k=3)
    docs.append(Document(page_content=live_update))
    docs.append(Document(page_content=additional_qa))

    if is_avail:
        availability_context = f"""
IMPORTANT AVAILABILITY CONTEXT:
- Notification sent on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
- Requested Timeframe: {date_ctx}
"""
        docs.append(Document(page_content=availability_context))

    answer = qa_chain.run(input_documents=docs, question=question)
    if is_avail:
        answer += "\n\n📧 I've sent Benitha a notification about your availability inquiry."

    return jsonify({'question': question, 'answer': answer})

@app.route('/health')
def health():
    ok = bool(vector_store and qa_chain and OPENAI_API_KEY and OPENAI_API_KEY != "your-default-key")
    return jsonify({'status': 'healthy' if ok else 'unhealthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
