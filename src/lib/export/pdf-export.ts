import type { Profile } from '../schema/profile';

const PDF_HEADER = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF';

export async function exportPdf(profile: Profile) {
  const bytes = new TextEncoder().encode(`${PDF_HEADER}\n% ${profile.fullName || 'Untitled Resume'}`);
  return new Blob([bytes], { type: 'application/pdf' });
}
