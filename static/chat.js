class ChatInterface {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.chatForm = document.getElementById('chat-form');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        this.pendingUserInfo = null;

        this.init();
        this.checkHealth();
    }

    init() {
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.userInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.userInput.addEventListener('input', (e) => this.handleInput(e));
        this.userInput.focus();

        // Add welcome message
        this.addMessage(
            "Hi there! I'm here to help you learn about Benitha. She's a talented frontend developer looking for new opportunities. Feel free to ask me anything about her skills, projects, or availability!",
            'bot'
        );
    }

    async checkHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            if (data.status === 'healthy' && data.ai_components && data.openai_configured) {
                this.updateStatus('connected', 'Connected');
            } else if (data.ai_components || data.openai_configured) {
                this.updateStatus('warning', 'Limited functionality');
            } else {
                this.updateStatus('error', 'Service unavailable');
            }
        } catch (error) {
            this.updateStatus('error', 'Connection issues');
            console.error('Health check failed:', error);
        }
    }

    updateStatus(type, message) {
        this.statusIndicator.className = 'fas fa-circle me-1';
        this.statusText.textContent = message;
        
        // Remove existing status classes
        this.statusIndicator.classList.remove('text-success', 'text-warning', 'text-danger');
        
        switch (type) {
            case 'connected':
                this.statusIndicator.classList.add('text-success');
                break;
            case 'warning':
                this.statusIndicator.classList.add('text-warning');
                break;
            case 'error':
                this.statusIndicator.classList.add('text-danger');
                break;
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit(e);
        }
    }

    handleInput(e) {
        const value = e.target.value.trim();
        this.sendButton.disabled = !value || this.isLoading();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const question = this.userInput.value.trim();
        
        if (!question || this.isLoading()) {
            return;
        }

        // Add user message to chat
        this.addMessage(question, 'user');
        this.userInput.value = '';
        this.setLoading(true);
        this.showTypingIndicator();

        try {
            // Prepare request body - using 'question' field to match backend
            const requestBody = { question };
            
            // Add user info if available (for availability requests)
            if (this.pendingUserInfo) {
                requestBody.user_info = this.pendingUserInfo;
            }

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            this.hideTypingIndicator();

            if (response.ok) {
                if (data.status === 'success') {
                    this.addMessage(data.answer, 'bot');
                    this.pendingUserInfo = null; // Clear user info after successful request
                } else if (data.status === 'user_info_required') {
                    this.addMessage(data.answer, 'bot');
                    this.showContactForm(question);
                } else {
                    this.addMessage(data.answer || 'Sorry, something went wrong.', 'bot', true);
                }
            } else {
                // Handle error responses
                const errorMessage = data.error || `Error ${response.status}: ${response.statusText}`;
                this.addMessage(errorMessage, 'bot', true);
            }
        } catch (error) {
            console.error('Chat request failed:', error);
            this.hideTypingIndicator();
            this.addMessage(
                'Connection error. Please check your internet connection and try again.', 
                'bot', 
                true
            );
        }

        this.setLoading(false);
        this.userInput.focus();
    }

    showContactForm(originalQuestion) {
        const formHtml = `
            <div class="message bot-message" id="contact-form-message">
                <div class="bot-avatar">
                    <i class="fas fa-user-plus"></i>
                </div>
                <div class="message-bubble">
                    <p class="mb-3">Please provide your contact information:</p>
                    <form id="contact-info-form">
                        <div class="mb-2">
                            <input type="text" id="contact-name" placeholder="Your Name *" 
                                class="form-control form-control-sm" required>
                        </div>
                        <div class="mb-2">
                            <input type="email" id="contact-email" placeholder="Your Email *" 
                                class="form-control form-control-sm" required>
                        </div>
                        <div class="mb-2">
                            <input type="text" id="contact-company" placeholder="Company (optional)" 
                                class="form-control form-control-sm">
                        </div>
                        <div class="mb-3">
                            <input type="text" id="contact-role" placeholder="Your Role (optional)" 
                                class="form-control form-control-sm">
                        </div>
                        <button class="btn btn-sm btn-primary" type="submit">
                            <i class="fas fa-paper-plane me-1"></i>Send Inquiry
                        </button>
                    </form>
                </div>
            </div>
        `;

        this.chatMessages.insertAdjacentHTML('beforeend', formHtml);
        this.scrollToBottom();

        // Handle form submission
        document.getElementById('contact-info-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const company = document.getElementById('contact-company').value.trim();
            const role = document.getElementById('contact-role').value.trim();

            if (!name || !email) {
                this.showError('Name and email are required.');
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                this.showError('Please enter a valid email address.');
                return;
            }

            // Store user info and retry the original question
            this.pendingUserInfo = { name, email, company, role };
            
            // Remove the contact form
            document.getElementById('contact-form-message').remove();
            
            // Resubmit the original question with user info
            this.userInput.value = originalQuestion;
            this.handleSubmit(new Event('submit'));
        });

        // Focus on the name input
        document.getElementById('contact-name').focus();
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="message-bubble user-bubble">
                    ${this.escapeHtml(content)}
                </div>
                <div class="message-time">${timestamp}</div>
            `;
        } else {
            const iconClass = isError ? 'fa-exclamation-triangle text-warning' : 'fa-robot';
            const bubbleClass = isError ? 'message-bubble bot-bubble error-message' : 'message-bubble bot-bubble';
            
            messageDiv.innerHTML = `
                <div class="bot-avatar">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="${bubbleClass}">
                    ${this.formatBotMessage(content)}
                </div>
                <div class="message-time">${timestamp}</div>
            `;
        }

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatBotMessage(content) {
        return this.escapeHtml(content)
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/📧/g, '<i class="fas fa-envelope text-primary"></i>')
            .replace(/🟢/g, '<i class="fas fa-circle text-success"></i>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message';
        typingDiv.id = 'typing-indicator-message';
        typingDiv.innerHTML = `
            <div class="bot-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator-message');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    setLoading(loading) {
        this.sendButton.disabled = loading || !this.userInput.value.trim();
        this.userInput.disabled = loading;
        
        if (loading) {
            this.loadingIndicator.classList.remove('d-none');
        } else {
            this.loadingIndicator.classList.add('d-none');
        }
    }

    isLoading() {
        return this.userInput.disabled;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTo({
                top: this.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.errorModal.show();
    }
}

// Initialize the chat interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.chatInterface) {
        window.chatInterface.checkHealth();
    }
});

window.addEventListener('offline', () => {
    if (window.chatInterface) {
        window.chatInterface.updateStatus('error', 'Offline');
    }
});