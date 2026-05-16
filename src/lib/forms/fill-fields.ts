export function fillField(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
