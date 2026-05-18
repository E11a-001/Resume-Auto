function fillSelectField(element: HTMLSelectElement, value: string) {
  const normalized = value.trim().toLowerCase();
  const option =
    Array.from(element.options).find((candidate) => candidate.value.trim().toLowerCase() === normalized) ??
    Array.from(element.options).find((candidate) => candidate.textContent?.trim().toLowerCase() === normalized);

  if (option) {
    element.value = option.value;
  }
}

export function fillField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  element.focus();

  if (element instanceof HTMLSelectElement) {
    fillSelectField(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
