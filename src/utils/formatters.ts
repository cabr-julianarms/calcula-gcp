export function formatCurrency(amountUSD: number, currency: 'USD' | 'BRL' = 'USD', exchangeRateBRL = 5.5): string {
  const safe = Number.isFinite(amountUSD) ? amountUSD : 0;
  if (currency === 'BRL') {
    return (safe * exchangeRateBRL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return safe.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Valor já convertido para a moeda de exibição, em formato curto para eixos de gráfico */
export function formatCompact(value: number, currency: 'USD' | 'BRL'): string {
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return value.toLocaleString(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
}

/** Variação mensal com sinal explícito (+ custo / − economia) */
export function formatDelta(deltaUSD: number, currency: 'USD' | 'BRL', exchangeRateBRL: number): string {
  const abs = formatCurrency(Math.abs(deltaUSD), currency, exchangeRateBRL);
  return deltaUSD < 0 ? `−${abs}` : `+${abs}`;
}
