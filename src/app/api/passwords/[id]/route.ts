import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET single password by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await db.passwordEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Password not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Failed to fetch password" }, { status: 500 });
  }
}

// PUT update password
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entry = await db.passwordEntry.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}

// DELETE password
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.passwordEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete password" }, { status: 500 });
  }
}
