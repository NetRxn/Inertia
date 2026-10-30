/** Feed cards ask the chat a question through this window event; ChatBar listens. */
export const ASK_EVENT = 'inertia:ask';

export function askChat(question: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: question }));
}
