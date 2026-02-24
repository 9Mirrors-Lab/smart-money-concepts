import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("gratitude")
      .select("id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ entries: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list gratitude";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text || text.length > 500) {
      return NextResponse.json(
        { error: "body required (1–500 chars)" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- gratitude table not in generated Supabase types yet
    const { data, error } = await (supabase as any)
      .from("gratitude")
      .insert({ body: text })
      .select("id, body, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create gratitude";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
