import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE!;
const DUITKU_API_KEY = process.env.DUITKU_API_KEY!;

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  try {
    const { items, totalAmount } = await req.json();

    if (!items?.length || !totalAmount) {
      return NextResponse.json({ error: "Data pesanan tidak lengkap" }, { status: 400 });
    }

    // Buat ID unik untuk transaksi demo
    const timestamp = String(Date.now());
    const demoOrderId = `DEMO-${timestamp}`;
    const isSandbox = DUITKU_MERCHANT_CODE.startsWith("DS");

    // Item details untuk Duitku
    const itemDetails = items.map((item: any) => ({
      name: String(item.name).substring(0, 50),
      price: Math.floor(Number(item.price)),
      quantity: Number(item.quantity),
    }));

    const productDetails = items
      .map((item: any) => `${item.name} x${item.quantity}`)
      .join(", ")
      .substring(0, 255);

    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    // Payload Duitku
    const payload = {
      paymentAmount: Math.floor(Number(totalAmount)),
      merchantOrderId: `${demoOrderId}-${timestamp.substring(8)}`,
      productDetails: `[DEMO] ${productDetails}`,
      email: "demo@restobookid.my.id",
      paymentMethod: "",
      phoneNumber: "08123456789",
      itemDetails: itemDetails,
      customerDetail: {
        firstName: "Demo",
        lastName: "Pelanggan",
        email: "demo@restobookid.my.id",
        phoneNumber: "08123456789",
      },
      callbackUrl: `${baseUrl}/api/payment/callback`,
      returnUrl: `${baseUrl}/demo-checkout`,
      expiryPeriod: 60,
    };

    // Signature Duitku
    const reqTimestamp = String(Date.now());
    const signatureString = `${DUITKU_MERCHANT_CODE}${reqTimestamp}${DUITKU_API_KEY}`;
    const signature = await sha256(signatureString);

    const url = isSandbox
      ? "https://api-sandbox.duitku.com/api/merchant/createInvoice"
      : "https://api-prod.duitku.com/api/merchant/createInvoice";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-duitku-signature": signature,
        "x-duitku-timestamp": reqTimestamp,
        "x-duitku-merchantcode": DUITKU_MERCHANT_CODE,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json(
        { error: `Duitku Gateway Error (${response.status})`, details: responseText.substring(0, 200) },
        { status: 400 }
      );
    }

    if (data.reference && data.paymentUrl) {
      return NextResponse.json({
        reference: data.reference,
        paymentUrl: data.paymentUrl,
        merchantOrderId: payload.merchantOrderId,
      });
    }

    const errorMsg = data.message || data.Message || data.statusMessage || "Unknown API Error";
    return NextResponse.json({ error: `Duitku: ${errorMsg}`, details: data }, { status: 400 });
  } catch (error: any) {
    console.error("Demo checkout API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
