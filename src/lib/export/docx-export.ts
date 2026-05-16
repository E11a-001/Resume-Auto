import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { Profile } from '../schema/profile';

export async function exportDocx(profile: Profile) {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: profile.fullName || 'Untitled Resume', bold: true })]
          }),
          ...profile.experiences.map(
            (experience) =>
              new Paragraph({
                children: [new TextRun(`${experience.title} - ${experience.company}`)]
              })
          )
        ]
      }
    ]
  });

  return Packer.toBlob(document);
}
