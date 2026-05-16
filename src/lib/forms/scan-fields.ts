import type { FieldDescriptor } from './semantic-map';

export function readFieldLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  const byId = element.id ? document.querySelector(`label[for="${element.id}"]`) : null;
  if (byId?.textContent) {
    return byId.textContent.trim();
  }

  return element.getAttribute('placeholder')?.trim() ?? element.getAttribute('name')?.trim() ?? '';
}

export function scanFields(root: Document): FieldDescriptor[] {
  const elements = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select'
  );

  return Array.from(elements)
    .map((element) => ({
      label: readFieldLabel(element),
      sectionHeading: element.closest('section, fieldset')?.querySelector('legend, h1, h2, h3')?.textContent?.trim()
    }))
    .filter((field) => field.label.length > 0);
}
