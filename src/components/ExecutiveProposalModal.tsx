import React, { useState } from 'react';
import { Download, Copy, Check, FileText, Loader2 } from 'lucide-react';
import { CalculatedCostItem, CalculatorSummary, WellArchitectedRecommendation } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';
import { PILLARS, PILLAR_ORDER, totalPotentialSavings } from '../services/wellArchitectedEngine';
import { Modal } from './ui';

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
  const [exporting, setExporting] = useState(false);
  const f = (v: number) => formatCurrency(v, currency, exchangeRateBRL);
  const delta = (v: number) => (Math.abs(v) < 0.005 ? '—' : `${v < 0 ? '-' : '+'}${f(Math.abs(v))}/mês`);
  const today = new Date().toLocaleDateString('pt-BR');
  const potential = totalPotentialSavings(recommendations);
  const rateNote = currency === 'BRL' ? ` Cotação usada: US$ 1 = R$ ${exchangeRateBRL.toFixed(2)}.` : '';

  const markdown = `# Estimativa de custos — Google Cloud

**Data:** ${today} · **Recursos:** ${summary.totalItems}

## 1. Cenários de contratação (mensal)

| Cenário | Mensal | Anual | Economia vs. sob demanda |
| :-- | --: | --: | --: |
| Sob demanda (com SUD automático) | ${f(summary.totalPaygMonthlyUSD)} | ${f(summary.totalPaygMonthlyUSD * 12)} | — |
| Compromisso 1 ano (CUD) | ${f(summary.totalCud1yrMonthlyUSD)} | ${f(summary.totalCud1yrMonthlyUSD * 12)} | ${summary.totalCud1yrSavingsPct.toFixed(1)}% |
| Compromisso 3 anos (CUD) | ${f(summary.totalCud3yrMonthlyUSD)} | ${f(summary.totalCud3yrMonthlyUSD * 12)} | ${summary.totalCud3yrSavingsPct.toFixed(1)}% |

Economia adicional identificada pela revisão Well-Architected: **${f(potential)}/mês** (sobre o cenário sob demanda).

## 2. Inventário

| Recurso | Produto GCP | Configuração | Região | Qtd | Sob demanda | CUD 1 ano | CUD 3 anos |
| :-- | :-- | :-- | :-- | --: | --: | --: | --: |
${calculatedItems
  .map((c) => `| ${c.originalResourceName} | ${c.gcpProductSuggested} | ${c.skuDetails} | ${c.item.region} | ${c.item.quantity || 1} | ${f(c.paygCostMonthly)} | ${f(c.cud1yrCostMonthly)} | ${f(c.cud3yrCostMonthly)} |`)
  .join('\n')}

## 3. Revisão Well-Architected

${PILLAR_ORDER.map((p) => {
  const list = recommendations.filter((r) => r.pillar === p);
  if (!list.length) return '';
  return `### ${PILLARS[p].label}\n\n${list.map((r) => `- **${r.title}** (${delta(r.monthlyDeltaUSD)}${r.deltaIsEstimate ? ', estimado' : ''}) — ${r.description}`).join('\n')}\n`;
})
  .filter(Boolean)
  .join('\n') || '_Nenhum achado para o inventário atual._'}

---
_Estimativa baseada em preços de lista públicos do Google Cloud, sem impostos nem descontos negociados.${rateNote} Confirme os valores finais na calculadora oficial (cloud.google.com/products/calculator)._
`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 14;
      let y = M;

      const ensure = (h: number) => {
        if (y + h > H - M) {
          doc.addPage();
          y = M;
        }
      };
      const text = (t: string, size = 10, bold = false, color: [number, number, number] = [30, 41, 59]) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(t, W - 2 * M) as string[];
        lines.forEach((line) => {
          ensure(size * 0.5);
          doc.text(line, M, y);
          y += size * 0.45;
        });
      };

      text('Estimativa de custos — Google Cloud', 16, true);
      y += 2;
      text(`Data: ${today}   ·   Recursos: ${summary.totalItems}`, 9, false, [100, 116, 139]);
      y += 4;

      text('Cenários (mensal / anual)', 12, true);
      y += 1;
      [
        ['Sob demanda', summary.totalPaygMonthlyUSD, ''],
        ['Compromisso 1 ano', summary.totalCud1yrMonthlyUSD, `(-${summary.totalCud1yrSavingsPct.toFixed(1)}%)`],
        ['Compromisso 3 anos', summary.totalCud3yrMonthlyUSD, `(-${summary.totalCud3yrSavingsPct.toFixed(1)}%)`],
      ].forEach(([label, v, pct]) => text(`${label}: ${f(v as number)}  /  ${f((v as number) * 12)} ${pct}`, 10));
      text(`Economia adicional Well-Architected: ${f(potential)}/mês`, 10, true, [5, 150, 105]);
      y += 4;

      text('Inventário', 12, true);
      y += 1;
      // 3 colunas de texto à esquerda + 3 colunas numéricas alinhadas à direita
      const textCols = [{ x: M, w: 46 }, { x: M + 48, w: 32 }, { x: M + 82, w: 28 }];
      const numRight = [W - M - 50, W - M - 25, W - M];
      const header = ['Recurso', 'Configuração', 'Região', 'Sob demanda', '1 ano', '3 anos'];
      const row = (cells: string[], bold = false) => {
        ensure(6);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        cells.forEach((cell, i) => {
          if (i < 3) doc.text((doc.splitTextToSize(cell, textCols[i].w) as string[])[0], textCols[i].x, y);
          else doc.text(cell, numRight[i - 3], y, { align: 'right' });
        });
        y += 5;
      };
      row(header, true);
      doc.setDrawColor(203, 213, 225);
      doc.line(M, y - 3.5, W - M, y - 3.5);
      calculatedItems.forEach((c) =>
        row([
          `${c.originalResourceName}${(c.item.quantity || 1) > 1 ? ` (x${c.item.quantity})` : ''}`,
          c.skuDetails,
          c.item.region,
          f(c.paygCostMonthly),
          f(c.cud1yrCostMonthly),
          f(c.cud3yrCostMonthly),
        ]),
      );
      y += 4;

      text('Revisão Well-Architected', 12, true);
      y += 1;
      PILLAR_ORDER.forEach((p) => {
        const list = recommendations.filter((r) => r.pillar === p);
        if (!list.length) return;
        y += 1;
        text(PILLARS[p].label, 10, true);
        list.forEach((r) => {
          text(`• ${r.title} (${delta(r.monthlyDeltaUSD)})`, 9, true, [51, 65, 85]);
          text(r.description, 8.5, false, [71, 85, 105]);
          y += 1;
        });
      });

      y += 4;
      text(`Estimativa baseada em preços de lista públicos, sem impostos nem descontos negociados.${rateNote} Confirme os valores na calculadora oficial do Google Cloud.`, 8, false, [100, 116, 139]);

      doc.save(`estimativa-gcp-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title="Proposta executiva"
      subtitle="Resumo dos cenários, inventário e revisão Well-Architected"
      icon={<FileText size={18} />}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copiado' : 'Copiar Markdown'}
          </button>
          <button className="btn btn-primary" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="spin" /> : <Download />} Baixar PDF
          </button>
        </>
      }
    >
      <div className="code-block" style={{ maxHeight: '55vh', overflowY: 'auto' }}>{markdown}</div>
    </Modal>
  );
};
