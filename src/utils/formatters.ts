export function formatCurrency(
  amountUSD: number,
  currency: 'USD' | 'BRL' = 'USD',
  exchangeRateBRL: number = 5.50
): string {
  const safeAmount = Number.isFinite(amountUSD) ? amountUSD : 0;
  if (currency === 'BRL') {
    const amountBRL = safeAmount * exchangeRateBRL;
    return `R$ ${amountBRL.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$ ${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
