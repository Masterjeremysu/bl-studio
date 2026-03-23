import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BatchItem, ExtractionResult, Template } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function exportToJSON(items: BatchItem[], templates: Template[]): void {
  const data = items
    .filter(i => i.status === 'success' && i.result)
    .map(item => ({
      fichier: item.file.name,
      fournisseur: templates.find(t => t.id === item.templateId)?.supplierName || 'Inconnu',
      traiteA: item.processedAt ? new Date(item.processedAt).toISOString() : null,
      donnees: item.result,
    }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `extraction_${Date.now()}.json`);
}

export function exportToCSV(items: BatchItem[], templates: Template[]): void {
  const successful = items.filter(i => i.status === 'success' && i.result);
  if (!successful.length) return;

  const allKeys = Array.from(
    new Set(successful.flatMap(i => Object.keys(i.result || {})))
  );
  const headers = ['Fichier', 'Fournisseur', 'Traité à', ...allKeys];
  const rows = successful.map(item => {
    const supplier = templates.find(t => t.id === item.templateId)?.supplierName || 'Inconnu';
    const date = item.processedAt ? new Date(item.processedAt).toLocaleString('fr-FR') : '';
    const values = allKeys.map(k => {
      const v = item.result?.[k] || '';
      return `"${v.replace(/"/g, '""')}"`;
    });
    return [`"${item.file.name}"`, `"${supplier}"`, `"${date}"`, ...values].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `extraction_${Date.now()}.csv`);
}

export function exportTemplates(templates: Template[]): void {
  const exportable = templates.map(t => ({
    ...t,
    sampleImage: '',
    pageImages: [],
    totalProcessed: t.totalProcessed || 0,
  }));
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `bl_studio_templates_${Date.now()}.json`);
}

export function importTemplatesFromFile(): Promise<Template[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject('Aucun fichier');
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Format invalide');
        resolve(data as Template[]);
      } catch (e) {
        reject('Fichier JSON invalide');
      }
    };
    input.click();
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
