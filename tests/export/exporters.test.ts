import { describe, expect, it } from 'vitest';
import { exportDocx } from '../../src/lib/export/docx-export';
import { exportPdf } from '../../src/lib/export/pdf-export';
import { emptyProfile } from '../../src/lib/schema/profile';

describe('resume exporters', () => {
  it('creates a DOCX blob and a PDF placeholder blob for a tailored profile', async () => {
    const profile = {
      ...emptyProfile(),
      fullName: 'Ella Example'
    };

    const docxBlob = await exportDocx(profile);
    const pdfBlob = await exportPdf(profile);

    expect(docxBlob.size).toBeGreaterThan(0);
    expect(pdfBlob.type).toBe('application/pdf');
  });
});
