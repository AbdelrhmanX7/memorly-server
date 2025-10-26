import axios from "axios";
import { Readable } from "stream";

/**
 * Generate AI response by calling external LLM service with streaming
 * Returns a readable stream for Server-Sent Events (SSE)
 */
export const generateAIResponseStream = async (
  userId: string,
  userQuery: string,
  limit: number = 10
): Promise<Readable> => {
  const llmServiceUrl = process.env.MEMORLY_INTERNAL_TOOLS_API;

  if (!llmServiceUrl) {
    throw new Error("MEMORLY_INTERNAL_TOOLS_API environment variable not configured");
  }

  try {
    // Make streaming request to LLM service
    const response = await axios.post(
      `${llmServiceUrl}/generate`,
      {
        query: userQuery,
        user_id: userId,
        limit: limit,
      },
      {
        responseType: "stream",
        timeout: 120000, // 120 seconds timeout
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
      }
    );

    // Return the stream
    return response.data as Readable;
  } catch (error: any) {
    console.error("LLM service error:", error);

    // Create error stream
    const errorStream = new Readable({
      read() {
        if (error.response?.status) {
          this.push(
            `data: ${JSON.stringify({
              type: "error",
              data: `LLM service error: ${error.response.status}`,
            })}\n\n`
          );
        } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
          this.push(
            `data: ${JSON.stringify({
              type: "error",
              data: "LLM service unavailable",
            })}\n\n`
          );
        } else {
          this.push(
            `data: ${JSON.stringify({
              type: "error",
              data: "Internal error during generation",
            })}\n\n`
          );
        }
        this.push(null);
      },
    });

    return errorStream;
  }
};
