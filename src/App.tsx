import React, { useState, useEffect } from 'react';
import { Template, AppStats, Theme, BatchItem } from './types';
import { applyTheme, loadTheme, saveTheme, getSystemTheme } from './lib/theme';
import { exportTemplates, importTemplatesFromFile } from './lib/utils';
import Dashboard from './components/Dashboard';
import TemplateEditor from './components/TemplateEditor';
import Extractor from './components/Extractor';
import ThemeToggle from './components/ThemeToggle';
import { ToastProvider, useToast } from './components/Toast';

type View = 'dashboard' | 'editor' | 'extractor';

function AppContent() {
  const { toast } = useToast();
  const [view, setView] = useState<View>('dashboard');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<AppStats>({ totalProcessed: 0, successCount: 0, errorCount: 0 });
  const [recentItems, setRecentItems] = useState<BatchItem[]>([]);
  const [theme, setTheme] = useState<Theme>(loadTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Load from localStorage
  useEffect(() => {
    try {
      const t = localStorage.getItem('bl_templates');
      if (t) setTemplates(JSON.parse(t));
      const s = localStorage.getItem('bl_stats');
      if (s) setStats(JSON.parse(s));
    } catch {}
  }, []);

  // Theme
  useEffect(() => {
    applyTheme(theme);
    const resolved = theme === 'auto' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { applyTheme('auto'); setResolvedTheme(getSystemTheme()); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    saveTheme(t);
  };

  const saveTemplates = (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('bl_templates', JSON.stringify(newTemplates));
  };

  const saveStats = (newStats: AppStats) => {
    setStats(newStats);
    localStorage.setItem('bl_stats', JSON.stringify(newStats));
  };

  const handleSaveTemplate = (template: Template) => {
    saveTemplates([...templates, template]);
    toast(`Modèle "${template.supplierName}" enregistré`, 'success');
    setView('dashboard');
  };

  const handleDeleteTemplate = (id: string) => {
    const t = templates.find(t => t.id === id);
    if (confirm(`Supprimer le modèle "${t?.supplierName}" ?`)) {
      saveTemplates(templates.filter(t => t.id !== id));
      toast('Modèle supprimé', 'info');
    }
  };

  const handleStatsUpdate = (success: boolean) => {
    const newStats: AppStats = {
      totalProcessed: stats.totalProcessed + 1,
      successCount: stats.successCount + (success ? 1 : 0),
      errorCount: stats.errorCount + (success ? 0 : 1),
    };
    saveStats(newStats);
  };

  const handleImportTemplates = async () => {
    try {
      const imported = await importTemplatesFromFile();
      const merged = [...templates];
      let added = 0;
      for (const t of imported) {
        if (!merged.find(m => m.id === t.id)) { merged.push(t); added++; }
      }
      saveTemplates(merged);
      toast(`${added} modèle(s) importé(s)`, 'success');
    } catch (e) {
      toast(String(e), 'error');
    }
  };

  const isLight = resolvedTheme === 'light';

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="logo-mark" style={{ cursor: 'pointer' }} onClick={() => setView('dashboard')}>
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
              <rect x="1" y="1" width="12" height="14" rx="1.5" stroke="var(--gold)" strokeWidth="1.5"/>
              <line x1="3" y1="5" x2="11" y2="5" stroke="var(--gold)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="3" y1="8" x2="11" y2="8" stroke="var(--gold)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="3" y1="11" x2="7" y2="11" stroke="var(--gold)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => setView('dashboard')}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text)', lineHeight: 1.1 }}>BL Studio</div>
            <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Extracteur intelligent</div>
          </div>

          <div className="h-separator" />

          {/* Nav tabs */}
          <nav style={{ display: 'flex', gap: 2 }}>
            {([
              { key: 'dashboard', label: '◈ Dashboard' },
              { key: 'editor',    label: '+ Modèle' },
              { key: 'extractor', label: '⟳ Traitement' },
            ] as { key: View; label: string }[]).map(item => (
              <button
                key={item.key}
                className={`nav-item ${view === item.key ? 'active' : ''}`}
                style={{ padding: '5px 12px', fontSize: 12 }}
                onClick={() => setView(item.key)}
                disabled={item.key === 'extractor' && templates.length === 0}
              >{item.label}</button>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* API status */}
          <div className="header-pill">
            <div className="status-dot success" />
            <span>Gemini Flash</span>
          </div>

          {/* Template actions */}
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={handleImportTemplates} title="Importer des modèles">
            ↑ Importer
          </button>
          {templates.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => exportTemplates(templates)} title="Exporter les modèles">
              ↓ Exporter
            </button>
          )}

          <div className="h-separator" />
          <ThemeToggle theme={theme} onChange={handleThemeChange} />
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar */}
        {view === 'dashboard' && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-label">Navigation</div>
              <div className="nav-item active">◈ Vue d'ensemble</div>
              <div className="nav-item" onClick={() => setView('extractor')} style={{ opacity: templates.length === 0 ? 0.4 : 1, pointerEvents: templates.length === 0 ? 'none' : 'auto' }}>
                ⟳ Traitement lot
                {stats.successCount > 0 && <span className="nav-badge accent">{stats.successCount}</span>}
              </div>
            </div>

            {templates.length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-label">Fournisseurs</div>
                {templates.map(t => (
                  <div key={t.id} className="nav-item" onClick={() => setView('extractor')}>
                    <span style={{ fontSize: 9, color: 'var(--gold)' }}>◎</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.supplierName}</span>
                    <span className="nav-badge">{t.zones.length}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div className="sidebar-label">Outils</div>
              <div className="nav-item" onClick={handleImportTemplates}>↑ Importer modèles</div>
              {templates.length > 0 && (
                <div className="nav-item" onClick={() => exportTemplates(templates)}>↓ Exporter modèles</div>
              )}
            </div>
          </aside>
        )}

        {/* Main */}
        <main className="main-content">
          {view === 'dashboard' && (
            <Dashboard
              templates={templates}
              stats={stats}
              recentItems={recentItems}
              onNewTemplate={() => setView('editor')}
              onExtract={() => setView('extractor')}
              onDeleteTemplate={handleDeleteTemplate}
            />
          )}
          {view === 'editor' && (
            <TemplateEditor
              onSave={handleSaveTemplate}
              onCancel={() => setView('dashboard')}
            />
          )}
          {view === 'extractor' && (
            <Extractor
              templates={templates}
              onBack={() => setView('dashboard')}
              onStatsUpdate={handleStatsUpdate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
