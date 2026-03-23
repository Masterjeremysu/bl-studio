import React, { useState, useCallback } from 'react';
import { Template, Zone, ExtractionResult, BatchItem, ProcessingStatus } from '../types';
import { convertAllPagesToBase64 } from '../lib/pdf';
import { exportToJSON, exportToCSV } from '../lib/utils';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI, Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './Toast';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MAX_RETRIES = 3;

interface Props {
  templates: Template[];
  onBack: () => void;
  onStatsUpdate: (success: boolean) => void;
}

const cropImage = (imageSrc: string, zone: Zone): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas failed');
      const sx = (zone.x / 100) * img.naturalWidth;
      const sy = (zone.y / 100) * img.naturalHeight;
      const sw = (zone.width / 100) * img.naturalWidth;
      const sh = (zone.height / 100) * img.naturalHeight;
      canvas.width = sw; canvas.height = sh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

const STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending: 'En attente',
  converting: 'Lecture...',
  identifying: 'Identification fournisseur...',
  extracting: 'Extraction IA...',
  success: 'Terminé',
  error: 'Erreur',
};

export default function Extractor({ templates, onBack, onStatsUpdate }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const updateItem = useCallback((id: string, updates: Partial<BatchItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const onDrop = (files: File[]) => {
    const newItems: BatchItem[] = files.map(file => ({
      id: uuidv4(), file, status: 'pending',
    }));
    setItems(prev => [...prev, ...newItems]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
  });

  const identifySupplier = async (base64: string): Promise<string> => {
    const names = templates.map(t => t.supplierName);
    const res = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { text: `Identifie le fournisseur parmi : ${names.join(', ')}. Réponds INCONNU si absent.` },
        { inlineData: { data: base64.split(',')[1], mimeType: 'image/jpeg' } },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { supplierName: { type: Type.STRING, enum: [...names, 'INCONNU'] } },
        },
      },
    }));
    return JSON.parse(res.text || '{}').supplierName || 'INCONNU';
  };

  const extractData = async (base64: string, template: Template): Promise<ExtractionResult> => {
    const parts: any[] = [{ text: "Expert OCR. Extrais les champs demandés depuis les images de zones d'un Bon de Livraison. Retourne un JSON précis." }];
    for (const zone of template.zones) {
      const crop = await cropImage(base64, zone);
      parts.push({ text: `Champ: "${zone.label}"` });
      parts.push({ inlineData: { data: crop.split(',')[1], mimeType: 'image/jpeg' } });
    }
    const props: any = {};
    template.zones.forEach(z => { props[z.label] = { type: Type.STRING }; });
    const res = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.OBJECT, properties: props, required: template.zones.map(z => z.label) },
      },
    }));
    if (!res.text) throw new Error('Aucun texte retourné');
    return JSON.parse(res.text);
  };

  const processQueue = async () => {
    setIsProcessing(true);
    const toProcess = items.filter(i => i.status === 'pending' || i.status === 'error');

    for (const item of toProcess) {
      updateItem(item.id, { status: 'converting', error: undefined });
      try {
        const pages = item.allPagesBase64 || await convertAllPagesToBase64(item.file);
        const base64 = pages[0];
        updateItem(item.id, { allPagesBase64: pages, imageBase64: base64, status: 'identifying' });

        const supplierName = await identifySupplier(base64);
        if (supplierName === 'INCONNU') throw new Error('Fournisseur non reconnu');

        const template = templates.find(t => t.supplierName === supplierName);
        if (!template) throw new Error(`Modèle introuvable pour ${supplierName}`);

        updateItem(item.id, { templateId: template.id, status: 'extracting' });
        const result = await extractData(base64, template);
        updateItem(item.id, { result, status: 'success', processedAt: Date.now() });
        onStatsUpdate(true);
        toast(`✓ ${item.file.name}`, 'success');
      } catch (err) {
        updateItem(item.id, { status: 'error', error: err instanceof Error ? err.message : String(err) });
        onStatsUpdate(false);
      }
    }
    setIsProcessing(false);
  };

  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'error').length;
  const successItems = items.filter(i => i.status === 'success');
  const selected = selectedItem ? items.find(i => i.id === selectedItem) : null;
  const progress = items.length > 0 ? Math.round((items.filter(i => i.status === 'success' || i.status === 'error').length / items.length) * 100) : 0;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={onBack}>←</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)' }}>Traitement par lot</h2>
          {items.length > 0 && (
            <span className="pill muted" style={{ fontFamily: 'var(--font-mono)' }}>
              {successItems.length}/{items.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {successItems.length > 0 && (
            <>
              <button className="btn btn-ghost" onClick={() => exportToCSV(items, templates)}>↓ CSV</button>
              <button className="btn btn-ghost" onClick={() => exportToJSON(items, templates)}>↓ JSON</button>
            </>
          )}
          <button
            className="btn btn-gold"
            onClick={processQueue}
            disabled={isProcessing || pendingCount === 0}
          >
            {isProcessing
              ? <><span className="spin">⟳</span> Traitement...</>
              : `▶ Traiter ${pendingCount} fichier${pendingCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {isProcessing && (
        <div className="progress-bar" style={{ borderRadius: 0, height: 3 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: file list */}
        <div style={{ width: '40%', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`} style={{ margin: 12, minHeight: 90, padding: 16, gap: 8, flex: '0 0 auto' }}>
            <input {...getInputProps()} />
            <div style={{ fontSize: 20, color: 'var(--muted)' }}>📂</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Glissez vos BL ici</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>PDF, PNG, JPG · plusieurs fichiers acceptés</div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '32px 0' }}>
                Aucun fichier en attente
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`processing-item ${item.status}`}
                    style={{ cursor: 'pointer', background: selectedItem === item.id ? 'var(--bg3)' : 'var(--bg2)', borderColor: selectedItem === item.id ? 'var(--border2)' : undefined }}
                    onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                  >
                    <StatusIcon status={item.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.file.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 6 }}>
                        <span>{STATUS_LABELS[item.status]}</span>
                        {item.templateId && (
                          <><span>·</span><span style={{ color: 'var(--gold)' }}>{templates.find(t => t.id === item.templateId)?.supplierName}</span></>
                        )}
                      </div>
                      {item.error && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 2 }}>{item.error}</div>}
                    </div>
                    <button
                      className="btn btn-icon"
                      style={{ width: 22, height: 22, fontSize: 11, color: 'var(--muted)', background: 'transparent', border: 'none', flexShrink: 0 }}
                      disabled={isProcessing}
                      onClick={e => { e.stopPropagation(); setItems(p => p.filter(i => i.id !== item.id)); if (selectedItem === item.id) setSelectedItem(null); }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: result preview */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg)' }}>
          {selected?.status === 'success' && selected.result ? (
            <ResultCard item={selected} templates={templates} />
          ) : successItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Cliquez sur un fichier pour voir son résultat</p>
              {successItems.map(item => (
                <ResultCard key={item.id} item={item} templates={templates} compact />
              ))}
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: 10 }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>📊</div>
              <p style={{ fontSize: 13 }}>Les résultats apparaîtront ici</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ProcessingStatus }) {
  const styles: Record<ProcessingStatus, { bg: string; color: string; icon: React.ReactNode }> = {
    pending:    { bg: 'var(--bg3)',                     color: 'var(--muted)',   icon: '○' },
    converting: { bg: 'rgba(74,158,255,0.1)',           color: 'var(--accent)',  icon: <span className="spin" style={{ display:'inline-block' }}>⟳</span> },
    identifying:{ bg: 'rgba(74,158,255,0.1)',           color: 'var(--accent)',  icon: <span className="spin" style={{ display:'inline-block' }}>⟳</span> },
    extracting: { bg: 'rgba(201,169,110,0.12)',         color: 'var(--gold)',    icon: <span className="spin" style={{ display:'inline-block' }}>⟳</span> },
    success:    { bg: 'rgba(60,193,122,0.12)',          color: 'var(--success)', icon: '✓' },
    error:      { bg: 'rgba(226,88,88,0.10)',           color: 'var(--error)',   icon: '✕' },
  };
  const s = styles[status];
  return (
    <div style={{ width: 26, height: 26, borderRadius: 7, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
      {s.icon}
    </div>
  );
}

function ResultCard({ item, templates, compact }: { item: BatchItem; templates: Template[]; compact?: boolean }) {
  const supplier = templates.find(t => t.id === item.templateId)?.supplierName || 'Inconnu';
  const entries = Object.entries(item.result || {});
  return (
    <div className="card" style={{ padding: compact ? '10px 12px' : '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 8 : 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {item.file.name}
        </div>
        <span className="pill gold" style={{ marginLeft: 8, flexShrink: 0 }}>{supplier}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr', gap: compact ? '6px 12px' : '8px 16px' }}>
        {entries.map(([key, value]) => (
          <div key={key}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{key}</div>
            <div style={{ fontSize: compact ? 12 : 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              {value || <span style={{ color: 'var(--muted)' }}>—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
