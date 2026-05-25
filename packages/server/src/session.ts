const sessions = new Map<string, { userId: string; expires: number }>();

export function createSession(userId: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, expires: Date.now() + 7 * 86400000 });
  return token;
}

export function getSessionUser(token: string | undefined | null): string | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
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
