import { NextRequest } from "next/server";
import { getUser, upsertUser, updateUser, type UserRole } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

const ROLES: UserRole[] = ["customer", "rider", "business"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("missing id");
  const user = getUser(id);
  if (!user) return bad("not found", 404);
  return json(user);
}

/** Registration: creates the profile with its role (the role is fixed afterwards). */
export async function POST(req: NextRequest) {
  const b = await body<{
    id?: string;
    phone?: string;
    full_name?: string;
    role?: UserRole;
    email?: string;
    city?: string;
    language?: "fr" | "en";
  }>(req);
  if (!b.id || !b.phone) return bad("missing id or phone");
  if (!b.full_name?.trim()) return bad("missing full_name");
  if (!b.role || !ROLES.includes(b.role)) return bad("invalid role");
  if (b.email && !EMAIL.test(b.email)) return bad("invalid email");
  return json(
    upsertUser({
      id: b.id,
      phone: b.phone,
      full_name: b.full_name,
      role: b.role,
      email: b.email ?? null,
      city: b.city,
      language: b.language,
    }),
  );
}

export async function PATCH(req: NextRequest) {
  const b = await body<{ id?: string; full_name?: string; email?: string | null; city?: string; language?: "fr" | "en" }>(req);
  if (!b.id) return bad("missing id");
  if (b.email && !EMAIL.test(b.email)) return bad("invalid email");
  const u = updateUser(b.id, b);
  if (!u) return bad("not found", 404);
  return json(u);
}
