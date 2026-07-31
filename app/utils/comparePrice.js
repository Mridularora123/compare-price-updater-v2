export function calculateDiscountedPrice(price, discount) {
  if (discount <= 0) {
    return Number(price).toFixed(2);
  }

  return (
    Number(price) *
    (1 - discount / 100)
  ).toFixed(2);
}