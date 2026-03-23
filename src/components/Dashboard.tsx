import React from 'react';
import { Template, BatchItem, AppStats } from '../types';

interface Props {
  templates: Template[];
  stats: AppStats;
  recentItems: BatchItem[];
  onNewTemplate: () => void;
  onExtract: () => void;
  onDeleteTemplate: (id: string) => void;
}

const SUPPLIER_COLORS = ['#C9A96E','#4A9EFF','#3CC17A','#E25858','#A78BFA','#F59E0B'];

export default function Dashboard({ templates, stats, recentItems, onNewTemplate, onExtract, onDeleteTemplate }: Props) {
  const successRate = stats.totalProcessed > 0
    ? Math.round((stats.successCount / stats.totalProcessed) * 1000) / 10
    : 100;

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)', lineHeight: 1.1 }}>
            Vue d'ensemble <em style={{ color: 'var(--gold)' }}>BL Studio</em>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {templates.length} modèle{templates.length !== 1 ? 's' : ''} actif{templates.length !== 1 ? 's' : ''}
            {stats.totalProcessed > 0 && ` · ${stats.totalProcessed} documents traités`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onNewTemplate}>+ Nouveau modèle</button>
          <button className="btn btn-gold" onClick={onExtract} disabled={templates.length === 0}>
            ⟳ Traiter des BL
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">BL traités</div>
          <div className="stat-value gold">{stats.totalProcessed}</div>
          <div className="stat-delta neu">Total cumulé</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taux de succès</div>
          <div className="stat-value">{successRate}<span style={{ fontSize: 14, color: 'var(--muted)' }}>%</span></div>
          <div className={`stat-delta ${successRate >= 95 ? '' : 'neg'}`}>
            {stats.successCount} succès / {stats.errorCount} erreurs
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Modèles</div>
          <div className="stat-value">{templates.length}</div>
          <div className="stat-delta neu">Fournisseurs configurés</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Zones par modèle</div>
          <div className="stat-value">
            {templates.length > 0
              ? Math.round(templates.reduce((a, t) => a + t.zones.length, 0) / templates.length)
              : 0}
          </div>
          <div className="stat-delta neu">Champs extraits en moy.</div>
        </div>
      </div>

      {/* Templates */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Modèles fournisseurs
        </span>
        {templates.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={onNewTemplate}
          >+ Ajouter</button>
        )}
      </div>

      {templates.length === 0 ? (
        <div
          className="dropzone"
          style={{ padding: 48, marginBottom: 28, gap: 12 }}
          onClick={onNewTemplate}
        >
          <div style={{ fontSize: 36, color: 'var(--border3)' }}>⊞</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text2)' }}>
            Aucun modèle configuré
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 340, textAlign: 'center' }}>
            Créez un modèle par fournisseur pour que l'IA sache où extraire les données.
          </p>
          <button className="btn btn-gold" style={{ marginTop: 8 }}>+ Créer mon premier modèle</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14, marginBottom: 28 }}>
          {templates.map((t, i) => {
            const color = SUPPLIER_COLORS[i % SUPPLIER_COLORS.length];
            return (
              <div key={t.id} className="template-card" onClick={onExtract}>
                <div className="template-preview">
                  {t.sampleImage ? (
                    <img
                      src={t.sampleImage}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, width: 90, opacity: 0.4 }}>
                      {[70, 100, 55, 85, 40].map((w, j) => (
                        <div key={j} style={{ height: 3, width: `${w}%`, background: 'var(--muted)', borderRadius: 2 }} />
                      ))}
                    </div>
                  )}
                  {/* Zone overlays */}
                  {t.sampleImage && t.zones.slice(0,3).map((z, zi) => (
                    <div key={z.id} style={{
                      position: 'absolute',
                      left: `${z.x}%`, top: `${z.y}%`,
                      width: `${z.width}%`, height: `${z.height}%`,
                      border: `1px solid ${color}`,
                      background: `${color}18`,
                      borderRadius: 2,
                    }} />
                  ))}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                    padding: '20px 10px 8px',
                  }}>
                    <span className="zone-badge" style={{ borderColor: `${color}40`, color, background: `${color}18` }}>
                      {t.zones.length} zones
                    </span>
                  </div>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{t.supplierName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Créé le {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <button
                    className="btn btn-icon btn-ghost"
                    style={{ fontSize: 12, flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                    title="Supprimer"
                  >✕</button>
                </div>
              </div>
            );
          })}
          {/* Add new card */}
          <div
            className="template-card"
            style={{ border: '1.5px dashed var(--border2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 150, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}
            onClick={onNewTemplate}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>+</div>
            <span>Nouveau modèle</span>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentItems.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Activité récente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentItems.slice(0, 6).map(item => (
              <div key={item.id} className="activity-item">
                <div className={`activity-icon ${item.status === 'success' ? 'success' : item.status === 'error' ? 'error' : 'pending'}`}>
                  {item.status === 'success' ? '✓' : item.status === 'error' ? '✕' : '⟳'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.file.name}
                  </div>
                  {item.error && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 2 }}>{item.error}</div>}
                  {item.result && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {Object.keys(item.result).slice(0,3).join(' · ')}
                      {Object.keys(item.result).length > 3 && ` +${Object.keys(item.result).length - 3}`}
                    </div>
                  )}
                </div>
                {item.processedAt && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                    {new Date(item.processedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
