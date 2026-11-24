import { NextRequest, NextResponse } from "next/server";
import { getAISettings, updateAISettings } from "@/lib/mock-store";

export async function GET() {
  return NextResponse.json(getAISettings());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const settings = updateAISettings({
    enabled: body.enabled,
    model: body.model,
    system_prompt: body.system_prompt,
    rate_limit: body.rate_limit,
  });
  return NextResponse.json(settings);
}