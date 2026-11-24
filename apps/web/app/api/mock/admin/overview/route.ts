import { NextRequest, NextResponse } from "next/server";
import { getOverview, getAuditLog } from "@/lib/mock-store";

export async function GET() {
  return NextResponse.json({ overview: getOverview(), audit: getAuditLog() });
}