import express, { Express, Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { wsMessageSchema } from "./types";
import { AzureOpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { functionCalls } from "./types/functionCalls";
import { StoreEntity, TableService } from "./services/data-table-service";
import { streamOpenAIResponseToClient } from "./helpers/streamOpenAIResponse";

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

let promptHistory: ChatCompletionMessageParam[] = [];
promptHistory.push({
  name: "system",
  role: "system",
  content:
    "You are a helpful assistant, for a record store, which sells vinyl records",
});

//Init TableService

const tableService = new TableService();

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected from IP: ${clientIp}`);
  let processing = false;
  ws.send(`Connection Established`);

  ws.on("message", async (message) => {
    if (processing) {
      console.log("Processing something already");
      return;
    }
    try {
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

            //call the streamAIResponse function
            processing = true;
            const finishedStream = await streamOpenAIResponseToClient(
              aiResponse,
              ws,
              promptHistory
            );
            if (finishedStream) {
              processing = false;
            }
            if (finishedStream.functionCallDetected) {
              //Set Timeout here to send a hold on message, to handle situations where functions calls take a long time
              //Preemptible will stop the previous send from speaking, so you can stop a filler phrase
              switch (finishedStream.functionName) {
                case "query_stock": {
                  if (finishedStream.functionArguments) {
                    const queryStockParams: {
                      RecordTitle: string;
                      Artist: string;
                      Genre: string;
                    } = JSON.parse(finishedStream.functionArguments);
                    const records = await tableService.queryStockEntities(
                      queryStockParams
                    );
                    let stores: StoreEntity[] = [];
                    records.forEach(async (stock) => {
                      const queryStoreParams = {
                        rowKey: stock.partitionKey,
                      };
                      stores.push(
                        await tableService.getStoreEntity(
                          queryStoreParams.rowKey
                        )
                      );
                    });

                    const stringyRecords = JSON.stringify(records);
                    const stringyStores = JSON.stringify(stores);
                    const aiResponse = await client.chat.completions.create({
                      messages: [
                        {
                          name: "system",
                          role: "system",
                          content: `You are a helpful assistant, for a record store, which sells vinyl records`,
                        },
                        {
                          name: "system",
                          role: "system",
                          content: `You will be provided with an array of stock data objects in JSON format.
                       Use *only* this data to answer the user's question. Do not use any prior knowledge.
                      If the answer cannot be found in the provided data, say so.
                      \n\nHere is the stock data:\n\`\`\`json\n${stringyRecords}\n\`\`\` Along with this stock information could be 
                      store information. The partition key of the stock, is a link to these store entries:
                      ${stringyStores}`,
                        },
                        {
                          name: "user",
                          role: "user",
                          content: typedMessage.data.voicePrompt,
                        },
                      ],
                      max_completion_tokens: 10000,
                      model: modelName,
                      stream: true,
                    });
                    processing = true;
                    const finishedStockStream =
                      await streamOpenAIResponseToClient(
                        aiResponse,
                        ws,
                        promptHistory
                      );
                    if (finishedStockStream) {
                      processing = false;
                    }
                    promptHistory = finishedStockStream.chatHistory;
                  }
                  break;
                }
              }
            } else {
              promptHistory = finishedStream.chatHistory;
            }
          }
        } else if (typedMessage.data.type === "end") {
          console.log("End of connection");
        }
      }
    } catch (e) {
      processing = false;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(8000, () => {
  console.log(`HTTP server listening at http://localhost:8000`);
});
