import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET all passwords
export async function GET() {
  try {
    const passwords = await db.passwordEntry.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(passwords);
  } catch {
    return NextResponse.json({ error: "Failed to fetch passwords" }, { status: 500 });
  }
}

// POST create a new password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, username, password, category, iconColor, notes, favorite } = body;

    if (!service || !username || !password) {
      return NextResponse.json(
        { error: "Service, username, and password are required" },
        { status: 400 }
      );
    }

    const entry = await db.passwordEntry.create({
      data: {
        service,
        username,
        password,
        category: category || "other",
        iconColor: iconColor || "#6366f1",
        notes: notes || null,
        favorite: favorite || false,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create password" }, { status: 500 });
  }
}
