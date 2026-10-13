export const convertToUSD = (inr) => {
  const rate = 83;
  return +(inr / rate).toFixed(2);
};