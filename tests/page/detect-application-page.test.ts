import { describe, expect, it } from 'vitest';

import { detectApplicationPage } from '../../src/lib/page/detect-application-page';

describe('detectApplicationPage', () => {
  it('recognizes job application pages from form and resume cues', () => {
    document.body.innerHTML = `
      <main>
        <h1>Apply for Product Analyst</h1>
        <form>
          <label for="resume">Resume</label>
          <input id="resume" type="file" />
          <label for="email">Email</label>
          <input id="email" type="email" />
          <label for="experience">Work Experience</label>
          <textarea id="experience"></textarea>
        </form>
      </main>
    `;

    expect(detectApplicationPage(document)).toMatchObject({
      isApplicationPage: true,
      confidence: 'high'
    });
  });
});
