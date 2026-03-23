import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Template, Zone } from '../types';
import { convertAllPagesToBase64 } from '../lib/pdf';
import { useDropzone } from 'react-dropzone';
import { useToast } from './Toast';

interface Props {
  onSave: (template: Template) => void;
  onCancel: () => void;
}

export default function TemplateEditor({ onSave, onCancel }: Props) {
  const { toast } = useToast();
  const [supplierName, setSupplierName] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [pendingZone, setPendingZone] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setLoading(true);
    try {
      const allPages = await convertAllPagesToBase64(files[0]);
      setPages(allPages);
      setCurrentPage(0);
      toast(`${allPages.length} page(s) chargée(s)`, 'success');
    } catch (e) {
      toast(String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
  });

  const getPos = (e: React.MouseEvent) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const r = imageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pages.length || pendingZone) return;
    const pos = getPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDrawing(true);
    setSelectedZone(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setCurrentPos(getPos(e));
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);
    if (width > 0.5 && height > 0.5) {
      setPendingZone({ x, y, width, height });
      setZoneName('');
    }
  };

  const handleAddZone = () => {
    if (!zoneName.trim() || !pendingZone) return;
    setZones(prev => [...prev, { id: uuidv4(), label: zoneName.trim(), ...pendingZone }]);
    setPendingZone(null);
    setZoneName('');
    toast(`Zone "${zoneName.trim()}" ajoutée`, 'success');
  };

  const handleDeleteZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedZone === id) setSelectedZone(null);
  };

  const handleRenameZone = (id: string, newLabel: string) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, label: newLabel } : z));
  };

  const handleSave = () => {
    if (!supplierName.trim()) { toast('Entrez un nom de fournisseur', 'error'); return; }
    if (!pages.length) { toast('Uploadez un exemple de BL', 'error'); return; }
    if (!zones.length) { toast('Définissez au moins une zone', 'error'); return; }
    onSave({
      id: uuidv4(),
      supplierName: supplierName.trim(),
      sampleImage: pages[0],
      pageImages: pages,
      zones,
      createdAt: Date.now(),
    });
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingZone) { setPendingZone(null); return; }
        if (selectedZone) { setSelectedZone(null); return; }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZone && !pendingZone) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT') {
          handleDeleteZone(selectedZone);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedZone, pendingZone]);

  const image = pages[currentPage];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={onCancel} title="Retour">←</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)' }}>Nouveau modèle</h2>
          <div className="h-separator" />
          <input
            className="input"
            placeholder="Nom du fournisseur..."
            value={supplierName}
            onChange={e => setSupplierName(e.target.value)}
            style={{ width: 220 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button className="btn btn-gold" onClick={handleSave}>💾 Enregistrer</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!pages.length ? (
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`} style={{ width: '100%', maxWidth: 520, height: 260, gap: 14 }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 32, color: 'var(--border3)' }}>📄</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text2)' }}>
                {loading ? 'Conversion en cours...' : 'Glissez un BL d\'exemple'}
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12 }}>PDF, PNG ou JPG · Toutes les pages seront chargées</p>
              {loading && <div className="spin" style={{ fontSize: 20, color: 'var(--gold)' }}>⟳</div>}
            </div>
          ) : (
            <>
              {/* Page navigation */}
              {pages.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>←</button>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    Page {currentPage + 1} / {pages.length}
                  </span>
                  <button className="btn btn-ghost btn-icon" onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1}>→</button>
                </div>
              )}

              {/* Drawing canvas */}
              <div
                ref={imageRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ position: 'relative', display: 'inline-block', cursor: pendingZone ? 'default' : 'crosshair', userSelect: 'none', boxShadow: 'var(--shadow-drop)', borderRadius: 4 }}
              >
                <img src={image} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', pointerEvents: 'none', display: 'block' }} />

                {/* Existing zones */}
                {zones.map(zone => (
                  <div
                    key={zone.id}
                    onClick={e => { e.stopPropagation(); setSelectedZone(zone.id); }}
                    onMouseEnter={() => setHoveredZone(zone.id)}
                    onMouseLeave={() => setHoveredZone(null)}
                    style={{
                      position: 'absolute',
                      left: `${zone.x}%`, top: `${zone.y}%`,
                      width: `${zone.width}%`, height: `${zone.height}%`,
                      border: `1.5px solid ${selectedZone === zone.id ? 'var(--gold)' : 'rgba(74,158,255,0.8)'}`,
                      background: selectedZone === zone.id ? 'rgba(201,169,110,0.15)' : 'rgba(74,158,255,0.1)',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                  >
                    {(hoveredZone === zone.id || selectedZone === zone.id) && (
                      <div style={{
                        position: 'absolute', top: -24, left: 0,
                        background: 'var(--bg2)', border: '1px solid var(--border2)',
                        borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--text)',
                        whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
                      }}>
                        {zone.label}
                      </div>
                    )}
                  </div>
                ))}

                {/* Live drawing */}
                {isDrawing && (
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(startPos.x, currentPos.x)}%`,
                    top: `${Math.min(startPos.y, currentPos.y)}%`,
                    width: `${Math.abs(currentPos.x - startPos.x)}%`,
                    height: `${Math.abs(currentPos.y - startPos.y)}%`,
                    border: '1.5px solid var(--gold)',
                    background: 'rgba(201,169,110,0.12)',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>

              <p style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                Glissez pour définir une zone · Cliquez sur une zone pour la sélectionner · <kbd style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Suppr</kbd> pour effacer · <kbd style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Esc</kbd> pour annuler
              </p>
            </>
          )}
        </div>

        {/* Sidebar zones */}
        <div style={{ width: 260, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>Zones à extraire</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{zones.length} zone{zones.length !== 1 ? 's' : ''} définie{zones.length !== 1 ? 's' : ''}</div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
            {zones.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '24px 12px' }}>
                Dessinez sur le document<br />pour créer des zones
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {zones.map((zone, i) => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    style={{
                      padding: '8px 10px',
                      background: selectedZone === zone.id ? 'var(--gold-dim)' : 'var(--bg3)',
                      border: `1px solid ${selectedZone === zone.id ? 'rgba(201,169,110,0.3)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', minWidth: 16 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <ZoneInput
                        value={zone.label}
                        onChange={v => handleRenameZone(zone.id, v)}
                      />
                      <button
                        className="btn btn-icon"
                        style={{ width: 22, height: 22, fontSize: 11, color: 'var(--error)', background: 'transparent', border: 'none', flexShrink: 0 }}
                        onClick={e => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                      >✕</button>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, paddingLeft: 24, fontFamily: 'var(--font-mono)' }}>
                      {zone.width.toFixed(0)}×{zone.height.toFixed(0)}% @ ({zone.x.toFixed(0)},{zone.y.toFixed(0)})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zone naming modal */}
      {pendingZone && (
        <div className="modal-overlay" onClick={() => setPendingZone(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 6, color: 'var(--text)' }}>
              Nommer la zone
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Quel champ correspond à cette sélection ?
            </p>
            <input
              className="input"
              autoFocus
              placeholder="ex: N° BL, Date, Total HT, Transporteur..."
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddZone(); if (e.key === 'Escape') setPendingZone(null); }}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setPendingZone(null)}>Annuler</button>
              <button className="btn btn-gold" onClick={handleAddZone} disabled={!zoneName.trim()}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <input
        className="input"
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        style={{ flex: 1, padding: '2px 6px', fontSize: 12, height: 24 }}
        onClick={e => e.stopPropagation()}
      />
    );
  }
  return (
    <span
      style={{ flex: 1, fontSize: 12, color: 'var(--text)', fontWeight: 500, cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      onDoubleClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      title="Double-cliquez pour renommer"
    >{value}</span>
  );
}
