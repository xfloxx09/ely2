export async function generateAvatarImage(
  prompt: string,
  replicateToken?: string
): Promise<string | null> {
  const token = replicateToken || process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return null;
  }

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "ac732df83cea7fff18b847276fa105fdd08d9db86f8f35c0f0e0a0e0e0e0e0e",
        input: {
          prompt,
          width: 512,
          height: 512,
          num_outputs: 1,
        },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const output = data.output;
    return Array.isArray(output) ? output[0] : output;
  } catch {
    return null;
  }
}

export function getPlaceholderAvatarUrl(params: { colorPalette: string[] }): string {
  const color = params.colorPalette[0]?.replace("#", "") || "6366f1";
  return `https://ui-avatars.com/api/?name=ELY&background=${color}&color=fff&size=256&bold=true&font-size=0.4`;
}
