import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { InventoryItem } from '../types/gcp';
import {
  parseCSVInventory,
  parseJSONInventory,
  parseYAMLInventory,
  parseTerraformHCL,
  generateSampleCSV,
  generateSampleJSON,
} from '../services/inventoryParser';
import { regionLabel } from '../data/regions';

interface InventoryUploaderProps {
  onItemsImported: (items: InventoryItem[]) => void;
  defaultRegion: string;
}

type Format = 'csv' | 'json' | 'yaml' | 'terraform';

export const InventoryUploader: React.FC<InventoryUploaderProps> = ({ onItemsImported, defaultRegion }) => {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [pasteFormat, setPasteFormat] = useState<Format>('csv');
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parse = (content: string, format: Format): InventoryItem[] => {
    switch (format) {
      case 'json': return parseJSONInventory(content, defaultRegion);
      case 'yaml': return parseYAMLInventory(content, defaultRegion);
      case 'terraform': return parseTerraformHCL(content, defaultRegion);
      default: return parseCSVInventory(content, defaultRegion);
    }
  };

  const report = (items: InventoryItem[], source: string) => {
    if (items.length > 0) {
      onItemsImported(items);
      setStatus({ type: 'success', text: `${items.length} recurso(s) importado(s) de ${source}.` });
    } else {
      setStatus({ type: 'error', text: `Nenhum recurso reconhecido em ${source}. Confira o formato ou baixe um modelo.` });
    }
  };

  const processFile = (file: File) => {
    const name = file.name.toLowerCase();
    const format: Format = name.endsWith('.json') ? 'json' : /\.ya?ml$/.test(name) ? 'yaml' : name.endsWith('.tf') ? 'terraform' : 'csv';
    const reader = new FileReader();
    reader.onload = (e) => report(parse(String(e.target?.result || ''), format), `"${file.name}"`);
    reader.onerror = () => setStatus({ type: 'error', text: `Não foi possível ler "${file.name}".` });
    reader.readAsText(file);
  };

  const download = (filename: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="importer">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Forma de importação">
          <button aria-pressed={mode === 'file'} onClick={() => setMode('file')}>Arquivo</button>
          <button aria-pressed={mode === 'paste'} onClick={() => setMode('paste')}>Colar texto</button>
        </div>
        <div className="spacer" />
        <span className="faint" style={{ fontSize: '0.76rem' }}>Modelos:</span>
        <button className="btn btn-sm btn-ghost" onClick={() => download('modelo-inventario-gcp.csv', generateSampleCSV(), 'text/csv')}>
          <Download /> CSV
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => download('modelo-inventario-gcp.json', generateSampleJSON(), 'application/json')}>
          <Download /> JSON
        </button>
      </div>

      {mode === 'file' ? (
        <div
          className={`dropzone ${dragActive ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            Array.from(e.dataTransfer.files).forEach(processFile);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.yaml,.yml,.tf,.txt"
            multiple
            hidden
            onChange={(e) => {
              Array.from(e.target.files || []).forEach(processFile);
              e.target.value = '';
            }}
          />
          <Upload />
          <h4>Arraste arquivos aqui ou clique para escolher</h4>
          <p>CSV, JSON, YAML, Terraform (.tf) ou export do Cloud Asset Inventory</p>
          <p className="faint" style={{ marginTop: 6 }}>Itens sem região vão para {regionLabel(defaultRegion)}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="seg" role="group" aria-label="Formato do texto" style={{ alignSelf: 'flex-start' }}>
            {(['csv', 'json', 'yaml', 'terraform'] as Format[]).map((fmt) => (
              <button key={fmt} aria-pressed={pasteFormat === fmt} onClick={() => setPasteFormat(fmt)}>
                {fmt === 'terraform' ? 'Terraform' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
          <textarea
            rows={6}
            className="mono"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`Cole o conteúdo ${pasteFormat === 'terraform' ? 'HCL' : pasteFormat.toUpperCase()} aqui…`}
            aria-label="Conteúdo do inventário"
          />
          <div>
            <button
              className="btn btn-primary"
              disabled={!pastedText.trim()}
              onClick={() => {
                const items = parse(pastedText, pasteFormat);
                report(items, 'texto colado');
                if (items.length) setPastedText('');
              }}
            >
              <FileText /> Importar
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className={`notice notice-${status.type}`} role="status">
          {status.type === 'success' ? <CheckCircle /> : <AlertCircle />}
          {status.text}
        </div>
      )}
    </div>
  );
};
