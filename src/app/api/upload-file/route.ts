import { UTApi } from "uploadthing/server";
import { NextRequest, NextResponse } from "next/server";

const utapi = new UTApi();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const response = await utapi.uploadFiles(file);
    if (!response.data?.ufsUrl) throw new Error("Upload failed");

    return NextResponse.json({ 
      url: response.data.ufsUrl, 
      name: file.name, 
      type: file.type,
      size: file.size
    });
  } catch (err) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}