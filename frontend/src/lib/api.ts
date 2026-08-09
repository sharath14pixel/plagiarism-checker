/**
 * API configuration and utility helpers
 */

export const getApiUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  // Remove any trailing slashes
  return url.replace(/\/+$/, "");
};

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const baseUrl = getApiUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  try {
    const response = await fetch(fullUrl, options);
    return response;
  } catch (err: any) {
    if (err.name === "TypeError" && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
      throw new Error(
        `Unable to reach backend server at ${baseUrl}. Please ensure your backend is live and configured in Vercel environment variables.`
      );
    }
    throw err;
  }
};
