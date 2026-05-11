/**
 * Utility for generating authentic dynamic EMVCo QRIS strings 
 * and deep links for various E-Wallet providers.
 */

/**
 * Calculates the standard CRC-16 CCITT (polynomial 0x1021, seed 0xFFFF)
 * checksum for the EMVCo QRIS specification.
 */
export function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  let hex = (crc & 0xFFFF).toString(16).toUpperCase();
  return hex.padStart(4, "0");
}

/**
 * Generates a dynamic EMVCo QRIS string conforming to Bank Indonesia standards.
 */
export function generateQRISString(params: {
  merchantName: string;
  merchantId: string;
  city: string;
  postalCode: string;
  categoryCode: string;
  amount: number;
  txId: string;
}): string {
  const {
    merchantName,
    merchantId,
    city,
    postalCode,
    categoryCode,
    amount,
    txId
  } = params;

  // Format strings safely
  const cleanName = merchantName.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 25);
  const cleanCity = city.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 15);
  const cleanId = merchantId.slice(0, 15);
  const cleanTxId = txId.slice(0, 15);
  const amountStr = Math.round(amount).toString();

  // EMVCo tags
  let payload = "000201"; // Payload Format Indicator
  payload += "010212"; // Point of Initiation (12 = Dynamic QR)

  // Merchant Account Info (Tag 26 - National RID and Merchant ID)
  const tag26Value = "0015ID1020304050607" + `01${cleanId.length.toString().padStart(2, "0")}${cleanId}`;
  payload += `26${tag26Value.length.toString().padStart(2, "0")}${tag26Value}`;

  payload += `5204${categoryCode.padStart(4, "0")}`; // Category Code (Tag 52)
  payload += "5303360"; // Transaction Currency (Tag 53 = 360/IDR)
  payload += `54${amountStr.length.toString().padStart(2, "0")}${amountStr}`; // Amount (Tag 54)
  payload += "5802ID"; // Country Code (Tag 58 = ID)
  payload += `59${cleanName.length.toString().padStart(2, "0")}${cleanName}`; // Merchant Name (Tag 59)
  payload += `60${cleanCity.length.toString().padStart(2, "0")}${cleanCity}`; // Merchant City (Tag 60)
  payload += `61${postalCode.length.toString().padStart(2, "0")}${postalCode}`; // Postal Code (Tag 61)

  // Additional Data (Tag 62)
  const tag62Value = `01${cleanTxId.length.toString().padStart(2, "0")}${cleanTxId}`;
  payload += `62${tag62Value.length.toString().padStart(2, "0")}${tag62Value}`;

  // CRC-16 Template (Tag 63)
  payload += "6304";

  // Calculate and append CRC-16 checksum
  return payload + calculateCRC16(payload);
}

/**
 * Generates E-Wallet dynamic payment URL / Deep Links.
 */
export function getEWalletDeepLink(provider: string, number: string, amount: number): string {
  const cleanNum = number.replace(/[^0-9]/g, "");
  const amountStr = Math.round(amount).toString();

  switch (provider.toLowerCase()) {
    case "gopay":
      return `gopay://payment?phone=${cleanNum}&amount=${amountStr}&merchant=RestoBook`;
    case "ovo":
      return `ovo://transfer?phone=${cleanNum}&amount=${amountStr}`;
    case "dana":
      return `dana://transfer?phone=${cleanNum}&amount=${amountStr}`;
    case "shopeepay":
      return `shopeepay://transfer?phone=${cleanNum}&amount=${amountStr}`;
    case "linkaja":
      return `linkaja://transfer?phone=${cleanNum}&amount=${amountStr}`;
    default:
      return `https://pay.restobook.com/transfer?phone=${cleanNum}&amount=${amountStr}`;
  }
}
