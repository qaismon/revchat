import { NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { getUserFromRequest } from "@/lib/auth";

const utapi = new UTApi();

export async function POST(req: NextRequest) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });

    const response = await utapi.uploadFiles(file);

    const url = response?.data?.ufsUrl ?? response?.data?.url;
    if (!url) return NextResponse.json({ error: "Upload failed" }, { status: 500 });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Voice upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}