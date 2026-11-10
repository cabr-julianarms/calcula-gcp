import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Code, CheckCircle, AlertCircle } from 'lucide-react';
import { InventoryItem, GCPRegion } from '../types/gcp';
import {
  parseCSVInventory,
  parseJSONInventory,
  parseYAMLInventory,
  parseTerraformHCL,
  generateSampleCSV,
  generateSampleJSON
} from '../services/inventoryParser';

interface InventoryUploaderProps {
  onItemsImported: (items: InventoryItem[]) => void;
  defaultRegion?: GCPRegion;
}

export const InventoryUploader: React.FC<InventoryUploaderProps> = ({ onItemsImported, defaultRegion = 'us-central1' }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [pasteFormat, setPasteFormat] = useState<'csv' | 'json' | 'terraform'>('csv');
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      let imported: InventoryItem[] = [];

      if (fileName.endsWith('.csv')) {
        imported = parseCSVInventory(content, defaultRegion);
      } else if (fileName.endsWith('.json')) {
        imported = parseJSONInventory(content);
      } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
        imported = parseYAMLInventory(content);
      } else if (fileName.endsWith('.tf') || fileName.includes('terraform')) {
        imported = parseTerraformHCL(content);
      } else {
        // Default fallback to CSV
        imported = parseCSVInventory(content, defaultRegion);
      }

      if (imported.length > 0) {
        onItemsImported(imported);
        setStatusMessage({
          type: 'success',
          text: `Sucesso! ${imported.length} item(ns) importado(s) do arquivo "${file.name}".`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Não foi possível identificar itens válidos no arquivo "${file.name}". Verifique o formato.`
        });
      }
    };

    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;

    let imported: InventoryItem[] = [];
    if (pasteFormat === 'csv') {
      imported = parseCSVInventory(pastedText, defaultRegion);
    } else if (pasteFormat === 'json') {
      imported = parseJSONInventory(pastedText);
    } else if (pasteFormat === 'terraform') {
      imported = parseTerraformHCL(pastedText);
    }

    if (imported.length > 0) {
      onItemsImported(imported);
      setStatusMessage({
        type: 'success',
        text: `Sucesso! ${imported.length} item(ns) importado(s) a partir do texto.`
      });
      setPastedText('');
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Erro ao interpretar o texto. Verifique o formato selecionado.'
      });
    }
  };

  const downloadFile = (filename: string, content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      
      {/* Header Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload style={{ width: '16px', height: '16px' }} /> Upload de Arquivo (CSV / JSON / YAML / Terraform)
          </button>
          <button
            className={`btn ${activeTab === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('paste')}
          >
            <Code style={{ width: '16px', height: '16px' }} /> Colar Texto / HCL
          </button>
        </div>

        {/* Template Downloads */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modelos de Exemplo:</span>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => downloadFile('modelo-inventario-gcp.csv', generateSampleCSV(), 'text/csv')}
          >
            <Download style={{ width: '12px', height: '12px' }} /> Modelo CSV
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => downloadFile('modelo-inventario-gcp.json', generateSampleJSON(), 'application/json')}
          >
            <Download style={{ width: '12px', height: '12px' }} /> Modelo JSON
          </button>
        </div>
      </div>

      {/* Tab 1: File Drop Zone */}
      {activeTab === 'upload' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--gcp-blue)' : 'var(--border-color-strong)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '32px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragActive ? 'rgba(66, 133, 244, 0.1)' : 'rgba(15, 23, 42, 0.3)',
            transition: 'var(--transition)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .json, .yaml, .yml, .tf"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
              }
            }}
          />
          <Upload style={{ width: '36px', height: '36px', color: 'var(--gcp-blue)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
            Arraste e solte seu arquivo de inventário aqui
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Suporta CSV, JSON, YAML, arquivos Terraform (.tf) ou exportação do GCP Cloud Asset Inventory
          </p>
        </div>
      )}

      {/* Tab 2: Text Paste */}
      {activeTab === 'paste' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Formato do Texto:</span>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="radio" name="fmt" checked={pasteFormat === 'csv'} onChange={() => setPasteFormat('csv')} /> CSV
            </label>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="radio" name="fmt" checked={pasteFormat === 'json'} onChange={() => setPasteFormat('json')} /> JSON
            </label>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="radio" name="fmt" checked={pasteFormat === 'terraform'} onChange={() => setPasteFormat('terraform')} /> Terraform HCL
            </label>
          </div>

          <textarea
            rows={5}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`Cole aqui o conteúdo em formato ${pasteFormat.toUpperCase()}...`}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '12px' }}
          />

          <button className="btn btn-primary" onClick={handleProcessPastedText}>
            <FileText style={{ width: '16px', height: '16px' }} /> Processar e Inserir no Inventário
          </button>
        </div>
      )}

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: statusMessage.type === 'success' ? '#34d399' : '#f87171',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {statusMessage.type === 'success' ? <CheckCircle style={{ width: '16px', height: '16px' }} /> : <AlertCircle style={{ width: '16px', height: '16px' }} />}
          {statusMessage.text}
        </div>
      )}
    </div>
  );
};
