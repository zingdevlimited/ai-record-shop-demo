import express, { Express, Request, Response } from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { wsMessageSchema } from "./types";

const app: Express = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("WebSocket Sever is running!!!");
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

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
        console.log(typedMessage.data);
        console.log(typedMessage.data.voicePrompt);
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
