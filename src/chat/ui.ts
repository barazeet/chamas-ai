export interface ChatUIHandlers {
  onSubmit: (message: string) => void;
}

export class ChatUI {
  private messages = document.getElementById('messages')!;
  private input = document.getElementById('chat-input') as HTMLInputElement;
  private button: HTMLButtonElement;

  constructor(handlers: ChatUIHandlers) {
    const form = document.getElementById('chat-form') as HTMLFormElement;
    this.button = form.querySelector('button[type="submit"]')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.input.value = '';
      handlers.onSubmit(text);
    });
  }

  setEnabled(enabled: boolean): void {
    this.input.disabled = !enabled;
    this.button.disabled = !enabled;
  }

  addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.textContent = text;
    this.messages.appendChild(el);
    while (this.messages.children.length > 100) {
      this.messages.firstElementChild!.remove();
    }
    this.messages.scrollTop = this.messages.scrollHeight;
    return el;
  }

  async typewriter(el: HTMLElement, text: string): Promise<void> {
    el.textContent = '';
    for (const ch of text) {
      el.textContent += ch;
      this.messages.scrollTop = this.messages.scrollHeight;
      await new Promise((r) => setTimeout(r, 18));
    }
  }
}
