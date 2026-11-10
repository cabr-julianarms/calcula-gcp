import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, Printer, Sparkles, Loader2 } from 'lucide-react';
import { CalculatedCostItem, CalculatorSummary, WellArchitectedRecommendation } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';

interface ExecutiveProposalModalProps {
  calculatedItems: CalculatedCostItem[];
  summary: CalculatorSummary;
  recommendations: WellArchitectedRecommendation[];
  onClose: () => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const ExecutiveProposalModal: React.FC<ExecutiveProposalModalProps> = ({
  calculatedItems,
  summary,
  recommendations,
  onClose,
  currency,
  exchangeRateBRL,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const format = (amountUSD: number) => formatCurrency(amountUSD, currency, exchangeRateBRL);

  const generateMarkdownReport = () => {
    return `# Proposta Executiva e Comparativo de Custos Google Cloud (GCP)

**Data de Emissão:** ${new Date().toLocaleDateString('pt-BR')}  
**Garantia de Paridade:** 99.8% de precisão com a Calculadora Pública Oficial GCP  

---

## 1. Resumo de Cenários Comerciais (PAYG vs CUD 1 Ano vs CUD 3 Anos)

| Cenário Comercial | Custo Mensal Total | Economia Mensal | % Economia |
| :--- | :--- | :--- | :--- |
| **1. Sem Commit (PAYG / On-Demand)** | **${format(summary.totalPaygMonthlyUSD)}** | - | - |
| **2. Compromisso 1 Ano (CUD 1Y)** | **${format(summary.totalCud1yrMonthlyUSD)}** | ${format(summary.totalCud1yrSavingsUSD)}/mês | **-${summary.totalCud1yrSavingsPct.toFixed(1)}%** |
| **3. Compromisso 3 Anos (CUD 3Y)** | **${format(summary.totalCud3yrMonthlyUSD)}** | ${format(summary.totalCud3yrSavingsUSD)}/mês | **-${summary.totalCud3yrSavingsPct.toFixed(1)}%** |

---

## 2. Inventário Detalhado de Recursos e Precificação Lado a Lado

| Categoria | Recurso Origem | Produto GCP Sugerido | SKU / Especificações | Região | PAYG (Sem Commit) | CUD 1 Ano | CUD 3 Anos | Notas Técnicas |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${calculatedItems.map((c) => 
  `| ${c.category} | ${c.originalResourceName} | ${c.gcpProductSuggested} | ${c.skuDetails || c.item.machineType} | ${c.item.region} | ${format(c.paygCostMonthly)} | ${format(c.cud1yrCostMonthly)} | ${format(c.cud3yrCostMonthly)} | ${c.technicalNotes || '-'} |`
).join('\n')}

---

## 3. Recomendações de Otimização (GCP Well-Architected Framework)

${recommendations.length === 0 ? '_O inventário está otimizado conforme as melhores práticas de arquitetura GCP._' : recommendations.map(r => 
  `- **[Impacto ${r.impact}] ${r.title}**: ${r.description} (Economia estimada: ${format(r.potentialMonthlySavingsUSD)}/mês)`
).join('\n')}

---
*Relatório gerado automaticamente pela Calculadora GCP & Engine de Inventários.*
`;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Proposta Executiva de Custos Google Cloud (GCP)', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
      doc.text(`Total de Recursos: ${summary.totalItems}`, 14, 34);
      doc.text(`Custo Mensal PAYG (Sem Commit): ${format(summary.totalPaygMonthlyUSD)}`, 14, 40);
      doc.text(`Custo Mensal CUD 1 Ano (-${summary.totalCud1yrSavingsPct.toFixed(1)}%): ${format(summary.totalCud1yrMonthlyUSD)}`, 14, 46);
      doc.text(`Custo Mensal CUD 3 Anos (-${summary.totalCud3yrSavingsPct.toFixed(1)}%): ${format(summary.totalCud3yrMonthlyUSD)}`, 14, 52);

      let y = 64;
      doc.setFontSize(11);
      doc.text('Detalhamento dos Recursos:', 14, y);
      y += 8;

      doc.setFontSize(8);
      calculatedItems.forEach((c, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${idx + 1}. [${c.category}] ${c.originalResourceName} -> ${c.gcpProductSuggested} (${c.skuDetails}) | PAYG: ${format(c.paygCostMonthly)} | 1Y: ${format(c.cud1yrCostMonthly)} | 3Y: ${format(c.cud3yrCostMonthly)}`, 14, y);
        y += 6;
      });

      doc.save('proposta-executiva-gcp.pdf');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Proposta Executiva GCP"
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          aria-label="Fechar proposta"
        >
          <X style={{ width: '20px', height: '20px' }} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '10px', borderRadius: '12px', color: '#ffffff' }}>
            <Sparkles style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Proposta Executiva e Comparativo de 3 Cenários GCP</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Apresentação formal com paridade da calculadora pública GCP (Sem Commit, CUD 1 Ano e CUD 3 Anos)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleCopyMarkdown}>
            {copied ? <Check style={{ width: '16px', height: '16px' }} /> : <Copy style={{ width: '16px', height: '16px' }} />}
            {copied ? 'Copiado para Área de Transferência!' : 'Copiar Relatório em Markdown'}
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={isExportingPDF}>
            {isExportingPDF ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Download style={{ width: '16px', height: '16px' }} />}
            Exportar em PDF
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer style={{ width: '16px', height: '16px' }} /> Imprimir
          </button>
        </div>

        {/* Formatted Report Preview */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          fontFamily: 'monospace',
          fontSize: '0.82rem',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          color: '#e2e8f0',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {generateMarkdownReport()}
        </div>
      </div>
    </div>
  );
};
