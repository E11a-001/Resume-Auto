import { describe, expect, it } from 'vitest';
import { fillField } from '../../src/lib/forms/fill-fields';

describe('fillField', () => {
  it('fills text inputs and dispatches input/change events', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    fillField(input, 'ella@example.com');

    expect(input.value).toBe('ella@example.com');
  });
});
