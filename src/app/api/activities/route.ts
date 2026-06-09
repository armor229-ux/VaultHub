import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET all activities
export async function GET() {
  try {
    const activities = await db.systemActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(activities);
  } catch {
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

// POST log a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, detail } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const activity = await db.systemActivity.create({
      data: {
        action,
        detail: detail || "",
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}
