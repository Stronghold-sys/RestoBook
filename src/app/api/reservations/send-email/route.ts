import { NextRequest, NextResponse } from "next/server";
import { sendReservationEmail } from "@/lib/sendReservationEmail";

export async function POST(req: NextRequest) {
  try {
    const { reservationId, status } = await req.json();
    if (!reservationId || !status) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const result = await sendReservationEmail(reservationId, status);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
