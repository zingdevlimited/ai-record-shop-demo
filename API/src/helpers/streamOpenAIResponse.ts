import { clear, error } from "console";
import {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { Stream } from "openai/streaming";
import { WebSocket } from "ws";
import { sendToSyncStream } from "./sendToSyncStream";
import { Twilio } from "twilio";

interface StreamProcessingResult {
  responseText: string;
  functionCallDetected: boolean;
  functionName?: string;
  functionArguments?: string;
  chatHistory: ChatCompletionMessageParam[];
}

export async function streamOpenAIResponseToClient(
  aiStream: Stream<ChatCompletionChunk>,
  ws: WebSocket,
  chatHistory: ChatCompletionMessageParam[],
  twilioClient: Twilio,
  timer?: any
): Promise<StreamProcessingResult> {
  let accumulatedResponseText = "";
  let accumulatedFunctionArgs = "";
  let functionCallDetected = false;
  let functionName = "";

  try {
    for await (const part of aiStream) {
      if (part.choices[0]) {
        const choices = part.choices[0];
        const delta = choices.delta;

        if (delta.tool_calls) {
          functionCallDetected = true;
          if (delta.tool_calls[0].function?.arguments) {
            accumulatedFunctionArgs += delta.tool_calls[0].function.arguments;
          }
          if (delta.tool_calls[0].function?.name) {
            functionName = delta.tool_calls[0].function.name;
          }
        } else if (delta.content) {
          const currentToken = delta.content;
          accumulatedResponseText += currentToken;
          let isLastToken = false;
          if (
            choices.finish_reason === "stop" ||
            choices.finish_reason === "tool_calls"
          ) {
            isLastToken = true;
          }
          if (currentToken !== "") {
            const textTokenMessage = {
              type: "text",
              token: currentToken,
              last: isLastToken,
            };
            ws.send(JSON.stringify(textTokenMessage));
            clearTimeout(timer);
          }
        }
      }
    }
  } catch (e) {
    console.error("Error processing OpenAI stream:", error);
  }
  if (accumulatedResponseText) {
    chatHistory.push({
      name: "system",
      role: "system",
      content: accumulatedResponseText,
    });
    await sendToSyncStream("System", accumulatedResponseText, twilioClient);
  }
  return {
    responseText: accumulatedResponseText,
    functionCallDetected: functionCallDetected,
    functionName: functionCallDetected ? functionName : undefined,
    functionArguments: functionCallDetected
      ? accumulatedFunctionArgs
      : undefined,
    chatHistory: chatHistory,
  };
}
