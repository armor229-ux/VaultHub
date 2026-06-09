import { NextResponse } from "next/server";

// Simulated system stats
export async function GET() {
  const stats = {
    storage: {
      used: 45.2,
      total: 128,
      unit: "GB",
      percentage: 35,
    },
    memory: {
      used: 5.4,
      total: 8,
      unit: "GB",
      percentage: 67,
    },
    battery: {
      level: 85,
      charging: false,
    },
    cache: {
      totalJunk: 2400, // MB
      categories: [
        { name: "App Cache", sizeMB: 856 },
        { name: "System Cache", sizeMB: 432 },
        { name: "Temporary Files", sizeMB: 318 },
        { name: "Clipboard Data", sizeMB: 124 },
        { name: "APK Files", sizeMB: 670 },
      ],
    },
  };

  return NextResponse.json(stats);
}
