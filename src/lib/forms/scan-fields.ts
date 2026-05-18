import type { FieldDescriptor } from './semantic-map';

function cleanedText(node: Element | null) {
  if (!node) {
    return '';
  }

  const clone = node.cloneNode(true) as Element;

  clone.querySelectorAll('input, textarea, select, button').forEach((element) => {
    element.remove();
  });

  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function normalizeLabelText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function isGenericPlaceholder(text: string) {
  const normalized = normalizeLabelText(text).toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    '请输入',
    '请选择',
    '请填写',
    'please enter',
    'please select',
    'optional',
    'required'
  ].some((marker) => normalized === marker || normalized.startsWith(`${marker} `));
}

function isMeaningfulLabel(text: string) {
  const normalized = normalizeLabelText(text);

  if (!normalized) {
    return false;
  }

  if (isGenericPlaceholder(normalized)) {
    return false;
  }

  return normalized.length <= 80;
}

function nearbyLabelFromBranch(branch: Element | null) {
  let sibling = branch?.previousElementSibling ?? null;
  let hops = 0;

  while (sibling && hops < 3) {
    const text = cleanedText(sibling);

    if (isMeaningfulLabel(text)) {
      return normalizeLabelText(text);
    }

    sibling = sibling.previousElementSibling;
    hops += 1;
  }

  return '';
}

function nearbyLabelFromAncestors(element: Element) {
  let branch: Element | null = element;
  let current: Element | null = element.parentElement;
  let depth = 0;

  while (branch && current && depth < 4) {
    const siblingLabel = nearbyLabelFromBranch(branch);

    if (siblingLabel) {
      return siblingLabel;
    }

    const parentLabel = nearbyLabelFromBranch(current);

    if (parentLabel) {
      return parentLabel;
    }

    branch = current;
    current = current.parentElement;
    depth += 1;
  }

  return '';
}

export function readFieldLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  const labelledBy = element.getAttribute('aria-labelledby');

  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => cleanedText(document.getElementById(id)))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  const byId = element.id ? document.querySelector(`label[for="${element.id}"]`) : null;
  if (byId?.textContent) {
    return byId.textContent.trim();
  }

  const wrappingLabel = cleanedText(element.closest('label'));

  if (wrappingLabel) {
    return wrappingLabel;
  }

  const nearbyLabel = nearbyLabelFromAncestors(element);

  if (nearbyLabel) {
    return nearbyLabel;
  }

  const placeholder = element.getAttribute('placeholder')?.trim() ?? '';

  if (placeholder && !isGenericPlaceholder(placeholder)) {
    return placeholder;
  }

  return element.getAttribute('name')?.trim() ?? '';
}

function describeField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  index: number
): FieldDescriptor | null {
  const label = readFieldLabel(element);

  if (!label) {
    return null;
  }

  return {
    id: `field-${index}`,
    label,
    sectionHeading: element.closest('section, fieldset, form')?.querySelector('legend, h1, h2, h3')?.textContent?.trim(),
    tagName: element.tagName.toLowerCase() as FieldDescriptor['tagName'],
    inputType: element instanceof HTMLInputElement ? element.type : undefined,
    placeholder: element.getAttribute('placeholder')?.trim() ?? undefined,
    options:
      element instanceof HTMLSelectElement
        ? Array.from(element.options)
            .map((option) => option.textContent?.trim() ?? option.value.trim())
            .filter(Boolean)
            .slice(0, 12)
        : undefined
  };
}

export function scanFields(root: Document): FieldDescriptor[] {
  const elements = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select'
  );

  return Array.from(elements)
    .map((element, index) => describeField(element, index))
    .filter((field): field is FieldDescriptor => field !== null);
}
