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
        
        this.init();
        this.checkHealth();
    }

    init() {
        // Event listeners
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.userInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.userInput.addEventListener('input', (e) => this.handleInput(e));
        
        // Focus on input
        this.userInput.focus();
        
        // Show initial bot message
        this.addMessage('Hello! I\'m Benitha\'s AI assistant. I can help you learn about her background, skills, experience, and availability. What would you like to know?', 'bot');
    }

    async checkHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            if (data.status === 'healthy' && data.ai_components && data.openai_configured) {
                this.updateStatus('connected', 'Connected');
            } else {
                this.updateStatus('warning', 'Limited functionality');
            }
        } catch (error) {
            this.updateStatus('error', 'Connection issues');
            console.error('Health check failed:', error);
        }
    }

    updateStatus(type, message) {
        this.statusIndicator.className = 'fas fa-circle me-1';
        this.statusText.textContent = message;
        
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
        // Auto-resize input if needed and validate
        const value = e.target.value.trim();
        this.sendButton.disabled = !value || this.isLoading();
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const question = this.userInput.value.trim();
        if (!question || this.isLoading()) {
            return;
        }

        // Add user message
        this.addMessage(question, 'user');
        
        // Clear input and disable form
        this.userInput.value = '';
        this.setLoading(true);
        
        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Prepare request body - include user info if available
            const requestBody = { question: question };
            if (this.pendingUserInfo) {
                requestBody.user_info = this.pendingUserInfo;
            }

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            // Remove typing indicator
            this.hideTypingIndicator();

            if (response.ok && data.status === 'success') {
                // Add bot response
                this.addMessage(data.answer, 'bot');
                this.updateStatus('connected', 'Connected');
                
                // Clear pending user info after successful submission
                this.pendingUserInfo = null;
                
            } else if (data.status === 'user_info_required') {
                // Show bot response first
                this.addMessage(data.answer, 'bot');
                
                // Then show contact form
                this.showContactForm(question);
                
            } else {
                // Handle error response
                const errorMessage = data.error || 'Sorry, I encountered an error processing your question.';
                this.addMessage(errorMessage, 'bot', true);
                this.updateStatus('error', 'Error occurred');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessage('I\'m sorry, but I\'m having trouble connecting right now. Please check your internet connection and try again.', 'bot', true);
            this.updateStatus('error', 'Connection failed');
        } finally {
            this.setLoading(false);
            this.userInput.focus();
        }
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    ${this.escapeHtml(content)}
                </div>
                <div class="message-time">${timestamp}</div>
            `;
        } else {
            const iconClass = isError ? 'fa-exclamation-triangle text-warning' : 'fa-robot';
            const bubbleClass = isError ? 'message-bubble error-message' : 'message-bubble';
            
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
        // Convert newlines to <br> and preserve formatting
        return this.escapeHtml(content)
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
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
                <span></span>
                <span></span>
                <span></span>
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
        this.sendButton.disabled = loading;
        this.userInput.disabled = loading;
        
        if (loading) {
            this.sendButton.classList.add('btn-loading');
            this.loadingIndicator.classList.remove('d-none');
        } else {
            this.sendButton.classList.remove('btn-loading');
            this.loadingIndicator.classList.add('d-none');
        }
    }

    isLoading() {
        return this.sendButton.disabled && this.sendButton.classList.contains('btn-loading');
    }

    scrollToBottom() {
        // Smooth scroll to bottom
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

    showContactForm(originalQuestion) {
        const contactFormHtml = `
            <div class="message bot-message" id="contact-form-message">
                <div class="bot-avatar">
                    <i class="fas fa-user-plus"></i>
                </div>
                <div class="message-bubble">
                    <div class="contact-form-container">
                        <h6 class="mb-3">Contact Information</h6>
                        <form id="contact-info-form">
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <input type="text" class="form-control form-control-sm" id="contact-name" placeholder="Your Name *" required>
                                </div>
                                <div class="col-md-6">
                                    <input type="email" class="form-control form-control-sm" id="contact-email" placeholder="Your Email *" required>
                                </div>
                                <div class="col-md-6">
                                    <input type="text" class="form-control form-control-sm" id="contact-company" placeholder="Company (optional)">
                                </div>
                                <div class="col-md-6">
                                    <input type="text" class="form-control form-control-sm" id="contact-role" placeholder="Your Role (optional)">
                                </div>
                            </div>
                            <div class="mt-3 d-flex gap-2">
                                <button type="submit" class="btn btn-primary btn-sm">
                                    <i class="fas fa-paper-plane me-1"></i>
                                    Send Notification
                                </button>
                                <button type="button" class="btn btn-secondary btn-sm" id="cancel-contact">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        this.chatMessages.insertAdjacentHTML('beforeend', contactFormHtml);
        this.scrollToBottom();
        
        // Add event listeners
        const contactForm = document.getElementById('contact-info-form');
        const cancelBtn = document.getElementById('cancel-contact');
        
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleContactFormSubmit(originalQuestion);
        });
        
        cancelBtn.addEventListener('click', () => {
            this.removeContactForm();
        });
        
        // Focus on first input
        document.getElementById('contact-name').focus();
    }

    async handleContactFormSubmit(originalQuestion) {
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const company = document.getElementById('contact-company').value.trim();
        const role = document.getElementById('contact-role').value.trim();
        
        if (!name || !email) {
            this.showError('Please provide at least your name and email address.');
            return;
        }
        
        // Store user info
        this.pendingUserInfo = {
            name: name,
            email: email,
            company: company || '',
            role: role || ''
        };
        
        // Remove the contact form
        this.removeContactForm();
        
        // Add confirmation message
        this.addMessage(`Thank you, ${name}! I'm sending your availability inquiry to Benitha now.`, 'bot');
        
        // Show typing indicator
        this.showTypingIndicator();
        this.setLoading(true);
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    question: originalQuestion,
                    user_info: this.pendingUserInfo
                })
            });

            const data = await response.json();
            this.hideTypingIndicator();

            if (response.ok && data.status === 'success') {
                this.addMessage(data.answer, 'bot');
                this.updateStatus('connected', 'Connected');
            } else {
                const errorMessage = data.error || 'Sorry, I encountered an error sending the notification.';
                this.addMessage(errorMessage, 'bot', true);
                this.updateStatus('error', 'Error occurred');
            }
        } catch (error) {
            console.error('Contact form error:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error sending your information. Please try again.', 'bot', true);
            this.updateStatus('error', 'Connection failed');
        } finally {
            this.setLoading(false);
            this.userInput.focus();
        }
    }

    removeContactForm() {
        const contactFormMessage = document.getElementById('contact-form-message');
        if (contactFormMessage) {
            contactFormMessage.remove();
        }
    }
}

// Initialize the chat interface when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});

// Handle connection status changes
window.addEventListener('online', () => {
    const chat = window.chatInterface;
    if (chat) {
        chat.updateStatus('connected', 'Connected');
        chat.checkHealth();
    }
});

window.addEventListener('offline', () => {
    const chat = window.chatInterface;
    if (chat) {
        chat.updateStatus('error', 'Offline');
    }
});
