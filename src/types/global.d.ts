import { GoogleGenAI } from "@google/genai";
import { Server as SocketIOServer } from "socket.io";

declare global {
  // Augment globalThis with the io property
  var io: SocketIOServer;
  var ai: GoogleGenAI;
}
export { };