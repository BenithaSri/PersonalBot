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

        this.addMessage(
            "Hello! I'm Benitha's AI assistant. I can help you learn about her background, skills, experience, and availability. What would you like to know?",
            'bot'
        );
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
        const value = e.target.value.trim();
        this.sendButton.disabled = !value || this.isLoading();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const question = this.userInput.value.trim();
        if (!question || this.isLoading()) return;

        this.addMessage(question, 'user');
        this.userInput.value = '';
        this.setLoading(true);
        this.showTypingIndicator();

        try {
            const body = { question };
            if (this.pendingUserInfo) body.user_info = this.pendingUserInfo;

            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            this.hideTypingIndicator();

            if (response.ok && data.status === 'success') {
                this.addMessage(data.answer, 'bot');
                this.pendingUserInfo = null;
            } else if (data.status === 'user_info_required') {
                this.addMessage(data.answer, 'bot');
                this.showContactForm(question);
            } else {
                this.addMessage(data.error || 'Sorry, something went wrong.', 'bot', true);
            }
        } catch (err) {
            console.error(err);
            this.hideTypingIndicator();
            this.addMessage('Connection error. Try again later.', 'bot', true);
        }

        this.setLoading(false);
        this.userInput.focus();
    }

    showContactForm(originalQuestion) {
        const formHtml = `
            <div class="message bot-message" id="contact-form-message">
                <div class="bot-avatar"><i class="fas fa-user-plus"></i></div>
                <div class="message-bubble">
                    <form id="contact-info-form">
                        <input type="text" id="contact-name" placeholder="Your Name *" class="form-control form-control-sm mb-2" required>
                        <input type="email" id="contact-email" placeholder="Your Email *" class="form-control form-control-sm mb-2" required>
                        <input type="text" id="contact-company" placeholder="Company (optional)" class="form-control form-control-sm mb-2">
                        <input type="text" id="contact-role" placeholder="Your Role (optional)" class="form-control form-control-sm mb-2">
                        <button class="btn btn-sm btn-primary" type="submit">Send</button>
                    </form>
                </div>
            </div>`;

        this.chatMessages.insertAdjacentHTML('beforeend', formHtml);
        this.scrollToBottom();

        document.getElementById('contact-info-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const company = document.getElementById('contact-company').value.trim();
            const role = document.getElementById('contact-role').value.trim();

            if (!name || !email) return this.showError('Name and email are required.');

            this.pendingUserInfo = { name, email, company, role };
            document.getElementById('contact-form-message').remove();
            this.userInput.value = originalQuestion;
            this.handleSubmit(new Event('submit'));
        });
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="message-bubble">${this.escapeHtml(content)}</div>
                <div class="message-time">${timestamp}</div>`;
        } else {
            const iconClass = isError ? 'fa-exclamation-triangle text-warning' : 'fa-robot';
            const bubbleClass = isError ? 'message-bubble error-message' : 'message-bubble';
            messageDiv.innerHTML = `
                <div class="bot-avatar"><i class="fas ${iconClass}"></i></div>
                <div class="${bubbleClass}">${this.formatBotMessage(content)}</div>
                <div class="message-time">${timestamp}</div>`;
        }

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatBotMessage(content) {
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
            <div class="bot-avatar"><i class="fas fa-robot"></i></div>
            <div class="typing-indicator"><span></span><span></span><span></span></div>`;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator-message');
        if (typingIndicator) typingIndicator.remove();
    }

    setLoading(loading) {
        this.sendButton.disabled = loading;
        this.userInput.disabled = loading;
        loading ? this.loadingIndicator.classList.remove('d-none') : this.loadingIndicator.classList.add('d-none');
    }

    isLoading() {
        return this.sendButton.disabled;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTo({ top: this.chatMessages.scrollHeight, behavior: 'smooth' });
        }, 100);
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.errorModal.show();
    }
}

document.addEventListener('DOMContentLoaded', () => new ChatInterface());
window.addEventListener('online', () => new ChatInterface().checkHealth());
window.addEventListener('offline', () => new ChatInterface().updateStatus('error', 'Offline'));
