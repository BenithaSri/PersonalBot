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
            `Hello! I'm Benitha's AI assistant. I can help you learn about her background, skills, experience, and availability. What would you like to know?`,
            'bot'
        );
    }

    async checkHealth() {
        try {
            const res = await fetch('/health');
            const data = await res.json();
            if (data.status === 'healthy') {
                this.updateStatus('connected', 'Connected');
            } else {
                this.updateStatus('warning', 'Limited functionality');
            }
        } catch {
            this.updateStatus('error', 'Connection error');
        }
    }

    updateStatus(type, message) {
        this.statusIndicator.className = 'fas fa-circle me-1';
        this.statusText.textContent = message;

        if (type === 'connected') this.statusIndicator.classList.add('text-success');
        else if (type === 'warning') this.statusIndicator.classList.add('text-warning');
        else this.statusIndicator.classList.add('text-danger');
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit(e);
        }
    }

    handleInput(e) {
        this.sendButton.disabled = !e.target.value.trim();
    }

    async handleSubmit(e) {
        e.preventDefault();

        const question = this.userInput.value.trim();
        if (!question) return;

        this.addMessage(question, 'user');
        this.userInput.value = '';
        this.setLoading(true);
        this.showTypingIndicator();

        try {
            const body = {
                question,
                ...(this.pendingUserInfo ? { user_info: this.pendingUserInfo } : {})
            };

            const res = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            this.hideTypingIndicator();

            if (res.ok && data.status === 'success') {
                this.addMessage(data.answer, 'bot');
                this.pendingUserInfo = null;
            } else if (data.status === 'user_info_required') {
                this.addMessage(data.answer, 'bot');
                this.showContactForm(question);
            } else {
                this.addMessage(data.error || 'Something went wrong.', 'bot', true);
            }
        } catch (err) {
            console.error(err);
            this.addMessage('Unable to connect. Try again.', 'bot', true);
        }

        this.setLoading(false);
    }

    addMessage(text, sender, isError = false) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (sender === 'user') {
            div.innerHTML = `<div class="message-bubble">${this.escapeHtml(text)}</div><div class="message-time">${timestamp}</div>`;
        } else {
            div.innerHTML = `
                <div class="bot-avatar"><i class="fas ${isError ? 'fa-exclamation-triangle text-warning' : 'fa-robot'}"></i></div>
                <div class="message-bubble ${isError ? 'error-message' : ''}">${this.formatBotMessage(text)}</div>
                <div class="message-time">${timestamp}</div>
            `;
        }

        this.chatMessages.appendChild(div);
        this.scrollToBottom();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatBotMessage(content) {
        return this.escapeHtml(content)
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    setLoading(loading) {
        this.sendButton.disabled = loading;
        this.userInput.disabled = loading;
        this.loadingIndicator.classList.toggle('d-none', !loading);
    }

    showTypingIndicator() {
        const div = document.createElement('div');
        div.id = 'typing-indicator';
        div.className = 'message bot-message';
        div.innerHTML = `<div class="bot-avatar"><i class="fas fa-robot"></i></div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
        this.chatMessages.appendChild(div);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const div = document.getElementById('typing-indicator');
        if (div) div.remove();
    }

    scrollToBottom() {
        this.chatMessages.scrollTo({ top: this.chatMessages.scrollHeight, behavior: 'smooth' });
    }

    showContactForm(originalQuestion) {
        const div = document.createElement('div');
        div.className = 'message bot-message';
        div.id = 'contact-form-message';

        div.innerHTML = `
            <div class="bot-avatar"><i class="fas fa-user-plus"></i></div>
            <div class="message-bubble">
                <form id="contact-info-form">
                    <h6 class="mb-2">Please provide your contact details:</h6>
                    <input type="text" id="contact-name" placeholder="Your Name *" required class="form-control form-control-sm mb-2">
                    <input type="email" id="contact-email" placeholder="Your Email *" required class="form-control form-control-sm mb-2">
                    <input type="text" id="contact-company" placeholder="Company (optional)" class="form-control form-control-sm mb-2">
                    <input type="text" id="contact-role" placeholder="Your Role (optional)" class="form-control form-control-sm mb-2">
                    <button class="btn btn-sm btn-primary mt-2" type="submit">Send Notification</button>
                </form>
            </div>
        `;

        this.chatMessages.appendChild(div);
        this.scrollToBottom();

        document.getElementById('contact-info-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const company = document.getElementById('contact-company').value.trim();
            const role = document.getElementById('contact-role').value.trim();

            if (!name || !email) {
                this.addMessage('Please fill out required fields.', 'bot', true);
                return;
            }

            this.pendingUserInfo = { name, email, company, role };
            document.getElementById('contact-form-message').remove();
            this.handleSubmit(new Event('submit'));
        });
    }
}

// Initialize after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});
