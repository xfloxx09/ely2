import { eq } from "drizzle-orm";
import { getDb, sessions } from "@ely/db";

const SESSION_TTL_MS = 7 * 86400000;

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  const db = getDb();

  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires,
  });

  return token;
}

export async function getSessionUser(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;

  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionToken, token))
    .limit(1);

  if (!session) return null;

  if (session.expires < new Date()) {
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
    return null;
  }

  return session.userId;
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.sessionToken, token));
}

export function getAuthToken(authHeader: string | null): string | null {
  return authHeader?.replace(/^Bearer\s+/i, "") || null;
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
