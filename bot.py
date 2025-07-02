import os
import logging
import re
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from langchain_community.vectorstores import FAISS
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
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "fallback-secret-key")
CORS(app)

# API Keys - properly handle environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-default-key")

# Resume content and additional data
resume_text = """
Benitha Mutesi - Front-End Developer

Professional Summary:
Front-End Developer with 2+ years of experience creating responsive, accessible web interfaces and intelligent applications. Skilled in React, JavaScript, HTML5, CSS3, and modern web technologies. Passionate about combining AI/ML capabilities with user-centric design to build innovative digital experiences.

Technical Skills:
• Frontend: React, JavaScript (ES6+), TypeScript, HTML5, CSS3, SASS/SCSS
• Frameworks & Libraries: Next.js, Redux, Material-UI, Bootstrap, Tailwind CSS
• Tools & Technologies: Git, Webpack, npm/yarn, Figma, Adobe Creative Suite
• AI/ML Integration: LangChain, OpenAI API, TensorFlow.js, Python
• Backend Basics: Node.js, Express.js, RESTful APIs, Firebase
• Testing: Jest, React Testing Library, Cypress

Professional Experience:

Frontend Developer | Tech Solutions Inc. | 2023 - Present
• Developed and maintained responsive web applications using React and modern JavaScript
• Collaborated with UX/UI designers to implement pixel-perfect, accessible user interfaces
• Integrated AI-powered features including chatbots and recommendation systems
• Optimized application performance, reducing load times by 40%
• Participated in code reviews and mentored junior developers

Junior Frontend Developer | Digital Innovations LLC | 2022 - 2023
• Built interactive web components using HTML5, CSS3, and vanilla JavaScript
• Worked closely with backend teams to integrate RESTful APIs
• Implemented responsive design principles for mobile-first applications
• Contributed to the company's design system and component library

Projects:

SPEAK - AI-Powered Communication Assistant
• React-based application with GPT integration for emotion-aware feedback
• Implemented real-time speech analysis and personalized coaching features
• Technologies: React, OpenAI API, Web Speech API, Material-UI

RAISE - Intelligent Resume Enhancement Platform
• Full-stack application helping users optimize resumes with AI insights
• Built responsive frontend with dynamic content generation
• Technologies: React, Node.js, LangChain, FAISS vector database

Resume AI Chatbot
• Personal branding tool using LangChain and OpenAI for intelligent Q&A
• Implemented vector search capabilities with FAISS for accurate responses
• Technologies: Python, LangChain, OpenAI API, FastAPI

Education:
Bachelor of Science in Computer Science | University of Technology | 2022
• Relevant Coursework: Web Development, Software Engineering, Data Structures, AI/ML Fundamentals
• Dean's List: Fall 2021, Spring 2022

Certifications:
• AWS Cloud Practitioner (2023)
• Google Analytics Certified (2023)
• React Developer Certification (2022)

Contact Information:
• Location: Available for remote work or relocation
• Email: benitha.mutesi@email.com
• LinkedIn: linkedin.com/in/benitha-mutesi
• GitHub: github.com/benitha-mutesi
• Portfolio: benitha-portfolio.com
"""

live_update = """
🟢 As of July 2, 2025:
Benitha is actively working on a resume-powered AI chatbot using LangChain, FAISS, and OpenAI. She's also enhancing the SPEAK and RAISE projects with GPT-based emotion feedback, and exploring how to build agentic assistants that connect job search workflows with custom classifiers. Currently seeking frontend developer opportunities that blend AI/ML with exceptional user experiences.
"""

additional_qa = """
Q: What are Benitha's available times for interviews?
A: Most weekdays after 2 PM EST; weekends on request. Flexible with different time zones for remote opportunities.

Q: What's her visa status?
A: On OPT (STEM), eligible to work in the US for up to 3 years. Open to visa sponsorship for the right opportunity.

Q: Career goals?
A: Frontend-focused roles blending AI/ML with real-world design challenges. Interested in positions at innovative companies working on AI-powered user experiences, particularly in EdTech, FinTech, or HealthTech sectors.

Q: Salary expectations?
A: Open to discussion based on role responsibilities, company size, and growth opportunities. Prioritizing learning and impact over compensation for the right fit.

Q: Remote work preference?
A: Open to remote, hybrid, or on-site opportunities. Has experience working effectively in distributed teams with strong communication skills.

Q: What makes Benitha unique?
A: Combines technical frontend expertise with AI/ML integration skills, creating intelligent user interfaces that adapt and learn. Strong background in accessibility and user-centered design principles.
"""

# Email notification functions
def send_availability_notification(question, user_info, date_context=""):
    """Send email notification when someone asks about availability"""
    gmail_email = os.environ.get('GMAIL_EMAIL')
    gmail_password = os.environ.get('GMAIL_APP_PASSWORD')
    
    if not gmail_email or not gmail_password:
        app.logger.warning("Gmail credentials not configured, skipping email notification")
        return False
    
    try:
        subject = f"Availability Inquiry from {user_info.get('name', 'Unknown')} - Resume Chatbot"
        
        # Create simple text email body
        body = f"""
New Availability Inquiry from Resume Chatbot

Contact Information:
- Name: {user_info.get('name', 'Not provided')}
- Email: {user_info.get('email', 'Not provided')}
- Company: {user_info.get('company', 'Not provided')}
- Role: {user_info.get('role', 'Not provided')}

Question: "{question}"

{f'Requested Timeframe: {date_context}' if date_context else ''}

Time Received: {datetime.now().strftime('%B %d, %Y at %I:%M %p EST')}

Next Steps:
- Reply directly to: {user_info.get('email', 'No email provided')}
- Check your calendar for the requested dates

This notification was sent automatically by your AI Resume Assistant.
        """
        
        # Create simple email message
        msg = MIMEText(body, 'plain')
        msg['Subject'] = subject
        msg['From'] = gmail_email
        msg['To'] = 'panchagirib@gmail.com'
        
        # Send email via Gmail SMTP
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(gmail_email, gmail_password)
            server.send_message(msg)
        
        app.logger.info("Availability notification sent successfully via Gmail SMTP")
        return True
        
    except Exception as e:
        app.logger.error(f"Failed to send availability notification: {e}")
        return False

def detect_availability_question(question):
    """Detect if a question is asking about availability or scheduling"""
    availability_patterns = [
        r'\b(available|availability)\b',
        r'\b(today|tomorrow|this week|next week)\b',
        r'\b(schedule|scheduling|appointment)\b',
        r'\b(interview|meeting|call)\b.*\b(when|time|date)\b',
        r'\b(free|busy)\b.*\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
        r'\b(can (you|she)|is (she|benitha)|would (she|benitha)) .* (meet|talk|available|free)\b',
        r'\b(what time|when can|when is)\b',
        r'\b(book|booking|set up)\b.*\b(meeting|interview|call)\b',
        r'\b(calendar|schedule)\b',
        r'\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b',  # Dates like 12/25/2024
        r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\b.*\b\d{1,2}\b',
    ]
    
    question_lower = question.lower()
    
    for pattern in availability_patterns:
        if re.search(pattern, question_lower, re.IGNORECASE):
            return True
    
    return False

def extract_date_context(question):
    """Extract specific dates or time references from the question"""
    date_patterns = [
        r'\b(today|tomorrow|tonight)\b',
        r'\b(this|next)\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
        r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
        r'\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b',
        r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b',
        r'\b\d{1,2}:\d{2}\s*(am|pm|AM|PM)\b',
    ]
    
    found_contexts = []
    question_lower = question.lower()
    
    for pattern in date_patterns:
        matches = re.findall(pattern, question_lower, re.IGNORECASE)
        found_contexts.extend(matches)
    
    return ", ".join(found_contexts) if found_contexts else ""

# Initialize the AI components
try:
    # Text splitting and embedding
    text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    resume_chunks = text_splitter.split_text(resume_text)
    
    # Create embeddings and vector store
    embeddings = OpenAIEmbeddings()
    vector_store = FAISS.from_texts(resume_chunks, embedding=embeddings)
    
    # Initialize the language model and QA chain
    llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.3)
    qa_chain = load_qa_chain(llm, chain_type="stuff")
    
    app.logger.info("AI components initialized successfully")
except Exception as e:
    app.logger.error(f"Failed to initialize AI components: {e}")
    vector_store = None
    qa_chain = None

@app.route('/')
def index():
    """Serve the main chat interface"""
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests with availability detection and email notifications"""
    try:
        data = request.get_json()
        if not data or 'question' not in data:
            return jsonify({'error': 'Question is required'}), 400
        
        question = data['question'].strip()
        if not question:
            return jsonify({'error': 'Question cannot be empty'}), 400
        
        # Check if AI components are available
        if not vector_store or not qa_chain:
            return jsonify({'error': 'AI service is temporarily unavailable'}), 503
        
        # Check if this is an availability-related question
        is_availability_question = detect_availability_question(question)
        date_context = ""
        
        if is_availability_question:
            # Check if user info is provided in the request
            user_info = data.get('user_info', {})
            
            # If no user info provided, request it
            if not user_info.get('name') and not user_info.get('email'):
                return jsonify({
                    'question': question,
                    'answer': "I'd be happy to help you get in touch with Benitha about her availability! To send her a notification with your inquiry, could you please provide your contact details? This helps her respond to you directly.",
                    'status': 'user_info_required',
                    'requires_user_info': True,
                    'availability_question': True
                })
            
            # Extract date context for the email
            date_context = extract_date_context(question)
            
            # Send email notification with user info
            email_sent = send_availability_notification(question, user_info, date_context)
            
            # Log the notification attempt
            if email_sent:
                app.logger.info(f"Availability notification sent for question: {question[:100]}... from {user_info.get('name', 'Unknown')}")
            else:
                app.logger.warning(f"Failed to send availability notification for: {question[:100]}...")
        
        # Retrieve relevant documents using vector similarity search
        docs = vector_store.similarity_search(question, k=3)
        
        # Add live update and additional Q&A data
        docs.append(Document(page_content=live_update))
        docs.append(Document(page_content=additional_qa))
        
        # If it's an availability question, add special context
        if is_availability_question:
            availability_context = f"""
            IMPORTANT AVAILABILITY CONTEXT:
            - This is a real-time availability inquiry that has been forwarded to Benitha
            - A notification has been sent to Benitha's email for immediate attention
            - For the most accurate and up-to-date availability, the person asking should expect a direct response
            - Current date/time: {datetime.now().strftime('%B %d, %Y at %I:%M %p EST')}
            - Requested timeframe: {date_context if date_context else 'Not specified'}
            
            Please provide a helpful response while mentioning that Benitha has been notified directly.
            """
            docs.append(Document(page_content=availability_context))
        
        # Generate response using the QA chain
        answer = qa_chain.run(input_documents=docs, question=question)
        
        # Enhance the response if it's an availability question
        if is_availability_question:
            answer += f"\n\n📧 **Note**: I've sent Benitha an email notification about your availability inquiry. She'll respond directly to provide the most accurate and current information about her schedule."
        
        app.logger.info(f"Question: {question[:100]}... | Answer generated successfully | Availability question: {is_availability_question}")
        
        return jsonify({
            'question': question,
            'answer': answer,
            'status': 'success',
            'availability_notification_sent': is_availability_question
        })
        
    except Exception as e:
        app.logger.error(f"Error in chat endpoint: {e}")
        return jsonify({
            'error': 'I apologize, but I encountered an error processing your question. Please try again or rephrase your question.',
            'status': 'error'
        }), 500

@app.route('/health')
def health():
    """Health check endpoint"""
    status = {
        'status': 'healthy',
        'ai_components': vector_store is not None and qa_chain is not None,
        'openai_configured': bool(OPENAI_API_KEY and OPENAI_API_KEY != "your-default-key")
    }
    return jsonify(status)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
