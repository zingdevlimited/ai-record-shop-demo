import { WebSocket } from "ws";

export function roundRobinResponse(
  ws: WebSocket,
  roundRobin: number
): {
  type: "Audio" | "Text";
  audioUrl: string;
  text: string;
} {
  const listOfTextResponses = [
    "One moment, let me have a look...",
    "Okay, just give me a second here...",
    "Right, let's see...",
    "Hmm, interesting, hold on...",
    "Just processing that now...",
    "Bear with me for a moment...",
    "Let me quickly check something...",
    "Okay, I'm just pulling that up...",
    "So, um, just a little pause...",
    "Yes, I'm just reviewing...",
    "Hold the line, please...",
    "Just thinking about that...",
    "Right then, let's have a look at this...",
    "Okay, just one more second...",
  ];
  roundRobin = (roundRobin + 1) % listOfTextResponses.length;
  const response = listOfTextResponses[roundRobin];
  return { type: "Text", text: response, audioUrl: "" };
}
