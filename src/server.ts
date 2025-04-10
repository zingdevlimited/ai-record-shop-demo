import express, { Express, Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { wsMessageSchema } from "./types";
import { AzureOpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { functionCalls } from "./types/functionCalls";

dotenv.config();
const app: Express = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("WebSocket Sever is running!!!");
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

const apiKey = process.env.LLM_API_KEY;
const apiVersion = "2024-12-01-preview";
const endpoint = "https://recordshopaifo3229622076.openai.azure.com/";
const modelName = "o3-mini";
const deployment = "o3-mini";
const options = { endpoint, apiKey, deployment, apiVersion };

const client = new AzureOpenAI(options);

const promptHistory: ChatCompletionMessageParam[] = [];
promptHistory.push({
  name: "system",
  role: "system",
  content:
    "You are a helpful assistant, for a record store, which sells vinyl records",
});

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected from IP: ${clientIp}`);

  ws.send(`Connection Established`);

  ws.on("message", async (message) => {
    const stringMessage = message.toString("utf-8");
    const parsed = JSON.parse(stringMessage);
    const typedMessage = wsMessageSchema.safeParse(parsed);
    if (typedMessage.success) {
      if (typedMessage.data.type === "prompt") {
        // Handle a "Interrupt" case, so we can deal with the history, Tool interruptions are harder.
        console.log(typedMessage.data);
        console.log(typedMessage.data.voicePrompt);
        if (typedMessage.data.lang && typedMessage.data.voicePrompt) {
          promptHistory.push({
            name: "user",
            role: "user",
            content: typedMessage.data.voicePrompt,
          });

          // Call open AI to generate a response
          const aiResponse = await client.chat.completions.create({
            messages: promptHistory,
            max_completion_tokens: 10000,
            model: modelName,
            stream: true,
            tools: functionCalls,
          });

          //Send the stream of the response back down the WS to Twilio
          let accumulatedResponse = "";
          let functionCall = false;
          let functionName = "";

          for await (const part of aiResponse) {
            let currentToken = "";
            let isLastToken = false;

            if (part.choices[0]) {
              const choices = part.choices[0];
              let delta;
              if (choices.delta) {
                delta = choices.delta;

                if (delta.tool_calls) {
                  functionCall = true;
                }
              }
              if (functionCall) {
                if (delta?.tool_calls) {
                  accumulatedResponse +=
                    delta.tool_calls[0].function?.arguments; // We build up the string of json eventually looks like {"RecordName": "The White Album"}
                  functionName =
                    delta.tool_calls[0].function?.name ?? functionName;
                }
              } else {
                currentToken = choices.delta.content ?? "";
                accumulatedResponse += currentToken;
                if (choices.finish_reason === "stop") {
                  isLastToken = true;
                }
                //Checking for the end of sentences to append the is last Token
                if (["!", "?", "."].includes(currentToken.slice(-1))) {
                  isLastToken = true;
                }
                if (currentToken !== "") {
                  const textTokenMessage = {
                    type: "text",
                    token: currentToken,
                    last: isLastToken,
                  };
                  console.log(textTokenMessage);
                  const messageToSend = JSON.stringify(textTokenMessage);
                  ws.send(messageToSend);
                }
              }
            }
          }
          if (functionCall) {
            //Set Timeout here to send a hold on message, to handle situations where functions calls take a long time
            //Preemptible will stop the previous send from speaking, so you can stop a filler phrase
            switch (functionName) {
              case "query_stock": {
                const queryStockParams: {
                  RecordName: string;
                  BandName: string;
                  Genre: string;
                } = JSON.parse(accumulatedResponse);
                console.log(queryStockParams);
                break;
              }
            }
          } else {
            promptHistory.push({
              name: "system",
              role: "system",
              content: accumulatedResponse, // TODO: think of when a user interupts a response mid way, how to to save the LLM conversation history correctly
            });
          }
        }
      } else if (typedMessage.data.type === "end") {
        console.log("End of connection");
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(8000, () => {
  console.log(`HTTP server listening at http://localhost:8000`);
});
