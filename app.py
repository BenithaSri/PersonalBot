import os
import logging
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.chat_models import ChatOpenAI
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
app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.environ.get("SESSION_SECRET", "fallback-secret-key")
CORS(app)

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-default-key")

# Resume content and additional data
resume_text = '''
Benitha Mutesi - Front-End Developer

CONTACT INFORMATION:
- Email: panchagirib@gmail.com
- Location: Available for remote work and relocation
- LinkedIn: Available upon request
- GitHub: Available upon request

PROFESSIONAL SUMMARY:
Experienced Front-End Developer with expertise in modern web technologies including React, JavaScript, HTML5, CSS3, and responsive design. Passionate about creating user-friendly interfaces and optimizing web performance. Strong background in collaborating with cross-functional teams and delivering high-quality web applications.

TECHNICAL SKILLS:
- Frontend: React.js, JavaScript (ES6+), HTML5, CSS3, SASS/SCSS, Bootstrap, Tailwind CSS
- Backend: Node.js, Express.js, Python basics
- Database: MongoDB, MySQL, PostgreSQL basics
- Tools & Technologies: Git, GitHub, VS Code, Figma, Adobe Creative Suite
- Testing: Jest, React Testing Library
- Deployment: Netlify, Vercel, Heroku
- API Integration: RESTful APIs, GraphQL basics

PROFESSIONAL EXPERIENCE:

Frontend Developer | Freelance | 2022 - Present
- Developed responsive web applications using React.js and modern JavaScript
- Collaborated with clients to understand requirements and deliver custom solutions
- Implemented responsive design principles ensuring cross-browser compatibility
- Optimized application performance and user experience
- Maintained and updated existing web applications

Web Developer Intern | Tech Solutions Inc. | 2021 - 2022
- Assisted in developing user interfaces for web applications
- Participated in code reviews and learned best practices
- Worked with senior developers on bug fixes and feature implementations
- Gained experience with version control systems and agile methodologies

EDUCATION:
Bachelor of Science in Computer Science | 2020
University of Technology
- Relevant coursework: Web Development, Database Systems, Software Engineering
- GPA: 3.7/4.0

NOTABLE PROJECTS:

E-Commerce Platform (2023)
- Built a full-featured e-commerce website using React.js and Node.js
- Implemented shopping cart functionality, user authentication, and payment integration
- Used MongoDB for data storage and Express.js for API development
- Technologies: React, Node.js, Express, MongoDB, Stripe API

Portfolio Website (2022)
- Created a responsive portfolio website showcasing development projects
- Implemented smooth animations and modern UI/UX design principles
- Optimized for SEO and performance
- Technologies: React, CSS3, JavaScript

Task Management App (2022)
- Developed a collaborative task management application
- Features include real-time updates, user roles, and project tracking
- Implemented drag-and-drop functionality and responsive design
- Technologies: React, Firebase, Material-UI

CERTIFICATIONS:
- React Developer Certification - Meta (2023)
- JavaScript Algorithms and Data Structures - freeCodeCamp (2022)
- Responsive Web Design - freeCodeCamp (2021)

LANGUAGES:
- English: Fluent
- French: Conversational
- Kinyarwanda: Native

ADDITIONAL INFORMATION:
- Available for full-time remote positions
- Open to relocation opportunities
- Strong communication and teamwork skills
- Continuous learner staying updated with latest web technologies
'''

live_update = '''
🟢 As of July 2, 2025:
Benitha is actively working on a resume-powered AI chatbot using LangChain, FAISS, and OpenAI. She has been expanding her skills in AI integration and vector databases. Currently available for new opportunities and interviews.

Recent Activities:
- Implementing AI-powered applications with Python and Flask
- Learning advanced LangChain techniques for document processing
- Exploring vector databases and semantic search capabilities
- Building intelligent chatbot systems with OpenAI integration

Current Availability:
- Actively seeking full-time frontend/fullstack developer positions
- Available for interviews and technical assessments
- Open to both remote and on-site opportunities
- Interested in AI/ML integration projects
'''

additional_qa = '''
Q: What are Benitha's available times for interviews?
A: Most weekdays after 2 PM EST; weekends on request. She's flexible with scheduling across different time zones and can accommodate urgent interview requests with advance notice.

Q: What is Benitha's visa status and work authorization?
A: Benitha is eligible to work in the United States and is open to discussing visa sponsorship opportunities. She's also available for remote work arrangements globally.

Q: What are Benitha's salary expectations?
A: Benitha's salary expectations are competitive and based on the role, location, and company size. She's open to discussing compensation packages that include benefits, growth opportunities, and work-life balance.

Q: What type of roles is Benitha looking for?
A: Benitha is primarily interested in Frontend Developer, React Developer, Full-Stack Developer, and UI/UX Developer roles. She's particularly excited about positions involving AI integration, modern web technologies, and user experience optimization.

Q: Can Benitha relocate?
A: Yes, Benitha is open to relocation for the right opportunity. She's particularly interested in tech hubs but is flexible based on the company and role requirements.

Q: What are Benitha's career goals?
A: Benitha aims to grow into a senior frontend role with opportunities to mentor junior developers and contribute to architectural decisions. She's interested in companies that value innovation, continuous learning, and work-life balance.
'''

# Email notification functions
def send_availability_notification(question, user_info, date_context=""):
    """Send email notification for availability inquiries"""
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

Question: \"{question}\"   
\
