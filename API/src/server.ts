import express, { Express, Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import twilio from "twilio";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { wsMessageSchema } from "./types";
import { AzureOpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { functionCalls } from "./types/functionCalls";
import {
  CustomerEntity,
  OrderEntity,
  StockEntity,
  StoreEntity,
  TableService,
} from "./services/data-table-service";
import { streamOpenAIResponseToClient } from "./helpers/streamOpenAIResponse";
import { roundRobinResponse } from "./helpers/roundRobinResponses";
import { sendToSyncStream } from "./helpers/sendToSyncStream";

dotenv.config();
const app: Express = express();

app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("WebSocket Sever is running!!!");
});

app.get("/GetToken", (req: Request, res: Response) => {
  // --- Configuration - Load from Environment Variables ---
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const syncServiceSid = process.env.TWILIO_SYNC_SERVICE_SID;

  // --- Input Validation ---
  const identity = req.query.identity;

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    console.error("Missing Twilio credentials in environment variables.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  if (!identity) {
    return res
      .status(400)
      .json({ error: "Missing 'identity' query parameter." });
  }

  // --- Create Twilio Access Token ---
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const SyncGrant = AccessToken.SyncGrant;

    // Create a new Sync Grant
    const syncGrant = new SyncGrant({
      serviceSid: syncServiceSid,
      // endpointId: `endpoint_id_for_${identity}` // Optional: unique ID for this specific client endpoint
    });

    // Create an Access Token instance
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: identity.toString(), // Associate the token with the user's identity
      ttl: 3600, // Optional: Time to live in seconds (e.g., 1 hour)
    });

    // Add the Sync Grant to the token
    token.addGrant(syncGrant);

    // Generate the JWT token string
    const jwtToken = token.toJwt();

    // --- Send Response ---
    console.log(`Generated Sync token for identity: ${identity}`);
    return res.status(200).json({ token: jwtToken });
  } catch (error) {
    console.error(
      `Error generating Twilio token for identity ${identity}:`,
      error
    );
    return res.status(500).json({ error: "Failed to generate token." });
  }
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

const twilioClient = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

let promptHistory: ChatCompletionMessageParam[] = [];

promptHistory.push({
  name: "system",
  role: "system",
  content: `You are a helpful assistant, for a record store, which sells vinyl records. Never read out partitionkey or rowkeys.
  Always return in plain text, with A-z. Numbers should be spelt out. Anything you reply with is being read out by an AI
  bot, so do not format the responses like text`,
});

//Init TableService
let stores: StoreEntity[] = [];
const tableService = new TableService();
const getStoreInfo = async () => {
  stores = await tableService.listStoreEntity();
  if (stores) {
    promptHistory.push({
      name: "system",
      role: "system",
      content: `Here is a list of shops. This list tells you the address, 
        and name of each store. The row key, is an identifier, which will be used later.#
        Do not speak about the store information until asked. Here is the list: ${JSON.stringify(
          stores
        )}`,
    });
  }
};
getStoreInfo();

wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected from IP: ${clientIp}`);
  let processing = false;
  let roundRobin = 0;
  ws.send(`Connection Established`);
  await sendToSyncStream(
    "System",
    "Hello and welcome to the record store, how can we help you today?",
    twilioClient
  );

  ws.on("message", async (message) => {
    let timer = null;
    let customerData: CustomerEntity | undefined;
    let orderData: { orders: OrderEntity[]; stock: StockEntity[] };
    if (processing) {
      console.log("Processing something already");
      return;
    }
    try {
      const stringMessage = message.toString("utf-8");
      const parsed = JSON.parse(stringMessage);
      const typedMessage = wsMessageSchema.safeParse(parsed);
      console.log(typedMessage);
      if (typedMessage.success) {
        if (typedMessage.data.type === "setup" && typedMessage.data.from) {
          let fromNumber = typedMessage.data.from;
          if (fromNumber === "client:Anonymous") {
            fromNumber = "7546606986";
          }
          customerData = await tableService.getCustomerByPhoneNumber(
            {
              PhoneNumber: fromNumber,
            },
            fromNumber
          );
          if (customerData) {
            promptHistory.push({
              name: "system",
              role: "system",
              content: `Here is the Customer who you are speaking with's information: ${JSON.stringify(
                customerData
              )}`,
            });
            orderData = await tableService.getCustomerOrders(
              customerData.rowKey
            );
            if (orderData.orders) {
              console.log("Hello");
              promptHistory.push({
                name: "system",
                role: "system",
                content: `Here is the Customer's order data with us': ${JSON.stringify(
                  orderData.orders
                )}`,
              });
            }
            if (orderData.stock) {
              promptHistory.push({
                name: "system",
                role: "system",
                content: `Here is the associated stock items for those orders': ${JSON.stringify(
                  orderData.stock
                )}`,
              });
            }
          }
          promptHistory.push({
            name: "system",
            role: "system",
            content: `Here is a list of Genres currently in stock:
            Hip Hop, Rock, Indie, Prog Rock, Alt Rock, Pop, Trip Hop, Folk Rock, Grunge, Punk`,
          });
        }
        if (typedMessage.data.type === "prompt") {
          timer = setTimeout(async () => {
            const nextPreemptResponse = roundRobinResponse(ws, roundRobin);
            let textTokenMessage;
            switch (nextPreemptResponse.type) {
              case "Text":
                textTokenMessage = {
                  type: "text",
                  token: nextPreemptResponse.text,
                  preemptible: true,
                  last: true,
                };
                ws.send(JSON.stringify(textTokenMessage));
                await sendToSyncStream(
                  "System",
                  nextPreemptResponse.text,
                  twilioClient
                );
            }

            roundRobin++;
          }, 500);
          // Handle a "Interrupt" case, so we can deal with the history, Tool interruptions are harder.
          if (typedMessage.data.lang && typedMessage.data.voicePrompt) {
            promptHistory.push({
              name: "user",
              role: "user",
              content: typedMessage.data.voicePrompt,
            });
            await sendToSyncStream(
              "User",
              typedMessage.data.voicePrompt,
              twilioClient
            );

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
              promptHistory,
              twilioClient,
              timer ?? undefined
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

                    const stringyRecords = JSON.stringify(records);
                    const aiResponse = await client.chat.completions.create({
                      messages: [
                        ...promptHistory,
                        {
                          name: "system",
                          role: "system",
                          content: `You will be provided with an array of stock data objects in JSON format.
                       Use this data (Or anything provided previously in this conversation) to answer the user's question .
                      If the answer cannot be found in the provided data, say so.
                      Please note, this is not everything available in our collection, just what has been provided by a database
                      search done prior to this. If a the user asks for something new, you will need to search the stock again.
                      \n\nHere is the stock data:\n\`\`\`json\n${stringyRecords}\n\`\`\`
                      Only respond with 5 maximum, avoid repeating the same album twice
                      Avoid recommending something that the customer already owns.
                      If there is nothing, use the provided genre list and pick a similar but different genre, and search through that`,
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
                      tools: functionCalls,
                    });
                    processing = true;
                    const finishedStockStream =
                      await streamOpenAIResponseToClient(
                        aiResponse,
                        ws,
                        promptHistory,
                        twilioClient,
                        timer
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
      console.log(e);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(8000, () => {
  console.log(`HTTP server listening at http://localhost:8000`);
});
