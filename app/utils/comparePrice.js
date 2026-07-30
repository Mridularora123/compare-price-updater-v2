export function calculateCompareAtPrice(price, discount) {
  if (discount <= 0) {
    return null;
  }

  return Math.round(
    Number(price) / (1 - discount / 100)
  ).toString();
}