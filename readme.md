# Record Store AI Assistant - Backend & Frontend Monitor

Link to Demo: [Click Here](https://zingdev-my.sharepoint.com/:v:/g/personal/joe_hainstock_zing_dev/ETaUQyLRub5Mr1ATi2VCQxABE5f5BG8HO2BUwqRQrYhG6Q?e=yL0maj&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D)

This project consists of two main parts:

1.  **Backend Server:** A Node.js application using Express, WebSockets, Twilio, Azure OpenAI, and Azure Table Storage. It handles the core logic for an AI-driven voice assistant for a record store, including managing conversation state, interacting with the language model, querying data, and streaming responses. It also publishes conversation updates to a Twilio Sync Stream.
2.  **Frontend Web Application:** A React application designed to monitor the conversation in real-time by subscribing to the Twilio Sync Stream populated by the backend server. It displays the conversation flow in a chat-like interface.

---

## Backend Server

This Node.js backend server powers the AI assistant. It integrates Twilio for communication (handling WebSocket streams potentially originating from voice calls and using Twilio Sync), Azure OpenAI for natural language processing, and an Azure Table Storage service (`data-table-service`) for data retrieval.

### Backend Features

* **WebSocket Server:** Handles real-time communication with voice clients.
* **Express API:** Provides HTTP endpoints (`/`, `/GetToken`).
* **Azure OpenAI Integration:** Uses Azure OpenAI (`o3-mini`) for conversation.
* **Function Calling:** Queries internal data sources (e.g., `query_stock`).
* **Streaming Responses:** Streams AI responses to the connected voice client.
* **Twilio Sync Publishing:** Pushes user prompts and AI responses to a designated Twilio Sync Stream for external monitoring.
* **Data Service Integration:** Connects to Azure Table Storage (`data-table-service`) for store, customer, order, and stock data.
* **Conversation Management:** Maintains context via `promptHistory`.
* **Interruption Handling:** Processes `interrupt` messages from the voice client.
* **Preemptive Waiting Messages:** Sends "hold on" messages during processing.
* **Configuration:** Uses `.env` file for credentials.

### Backend Prerequisites

* Node.js and npm (or yarn)
* Azure Account (OpenAI Service, Storage Account)
* Twilio Account (Account SID, Auth Token, API Key SID/Secret, Sync Service SID)
* Git (optional)

### Backend Installation & Setup

1.  **Clone the repository:** `git clone <repository-url>`
2.  **Navigate to the backend directory:** `cd <backend-project-directory>` (Assuming separate directories)
3.  **Install dependencies:** `npm install` (or `yarn install`)
4.  **Create `.env` file:** Populate with credentials (see below).
5.  **Compile TypeScript:** `npm run build` (uses `esbuild` as per `package.json`)
6.  **Run the server:** `npm start` (runs `node dist/server.js`) or `yarn dev` for development (uses `nodemon` and `ts-node`).

### Backend Environment Variables (`.env`)

```dotenv
# Twilio Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_SYNC_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxx # SID of the Sync Service to use

# Twilio Client Credentials (used for sending Sync messages)
ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_TOKEN=your_twilio_auth_token

# Azure OpenAI Credentials
LLM_API_KEY=your_azure_openai_api_key
LLM_ENDPOINT="[https://recordshopaifo3229622076.openai.azure.com/](https://recordshopaifo3229622076.openai.azure.com/)"

```

## Backend API Endpoints

-   `GET /`: Health check.
-   `GET /GetToken?identity=<user_identity>`: Generates Twilio Access Token with Sync grants. Used by both voice clients (potentially) and the frontend monitor app.

## WebSocket Endpoint

-   `ws://YourTunneledAPI.com`: Primary interaction point for the voice client (handles setup, prompt, interrupt, end messages; streams text responses).
- Consider using cloudflared tunnel for use with Twilio

# Frontend Web Application (Conversation Monitor)

This is a React application built with Create React App and TypeScript. It serves as a visual monitor for the AI conversation happening via the backend. It connects to the same Twilio Sync Stream that the backend publishes messages to and displays the conversation in a chat interface.

## Frontend Features

-   **Real-time Conversation Display**: Subscribes to the Twilio Sync Stream and displays messages as they are published by the backend.
-   **Chat Interface**: Renders messages with alignment differentiating "System" (AI/Backend) and "User" inputs.
-   **Typewriter Effect**: Uses a custom `TypewriterText` component to display System messages with a typing animation.
-   **Interrupt Handling (Visual)**: Listens for special `interrupt: true` signals on the Sync Stream. When received, it flags the last displayed System message to stop its typewriter effect, visually representing the interruption.
-   **Token Fetching**: Retrieves its own Twilio Sync access token from the backend's `/GetToken` endpoint.

## Frontend Prerequisites

-   Node.js and npm (or yarn)
-   A running instance of the backend server (to provide the `/GetToken` endpoint and publish Sync messages).

## Frontend Installation & Setup

1.  Navigate to the frontend directory: `cd <frontend-project-directory>` (Assuming separate directories)
2.  Install dependencies: `npm install` (or `yarn install`)
3.  **Configure Backend URL**:
    -  Create a .env file which includes the following:

    ```env
    REACT_APP_API_BASE_URL=<Your API URL>
    ```

4.  Run the development server: `npm start` (or `yarn start`). This will typically open the app in your browser at `http://localhost:3000`.

## Frontend How it Works (SyncStreamComponent)

-   **Initialization**: On mount, the component fetches a Twilio Access Token from the configured backend URL using the hardcoded identity `WebApp`.
-   **Sync Client**: Initializes the `twilio-sync` client with the token and sets up listeners for connection state changes and token expiry (including refresh logic).
-   **Stream Subscription**: Subscribes to the Twilio Sync Stream identified by the `streamNameOrSid` prop.
-   **Message Listener**: Listens for `messagePublished` events on the stream.
-   **Message Processing**:
    -   When a message arrives, its data payload (`{ text, author, messageId, interrupt? }`) is extracted.
    -   **Interrupt Signal**: If the incoming message data contains `interrupt: true`, the component finds the last message already in its state and updates that message object by adding an `interrupt: true` flag to it. This signals the `TypewriterText` component rendering that specific message to stop typing.
    -   **Regular Message**: If it's not an interrupt signal, the new message data is appended to the `messages` state array.
-   **Rendering**: The component maps over the `messages` array, rendering each message in a list item styled like a chat bubble. System messages use the `TypewriterText` component, passing the interrupt flag. User messages are displayed directly.
-   **Cleanup**: On unmount, listeners are removed, and the Sync client is shut down.

# Overall Architecture Flow

```text
1. User (Voice) <---> Twilio Voice Service
                       |
                       | (Bi-directional Stream)
                       v
2. Backend Server (ws://localhost:8000)
   - Receives audio/events from Twilio
   - Sends audio/commands to Twilio
   - Interacts with Azure OpenAI (LLM)
   - Interacts with Azure Table Storage (Data)
   - Publishes conversation messages ("User:", "System:") to Twilio Sync Stream ---> 3. Twilio Sync Service
                                                                                           |
                                                                                           | (Sync Stream Updates)
                                                                                           v
4. Frontend Monitor App (http://localhost:3000) <------------------------------------
   - Fetches Token from Backend (/GetToken)
   - Subscribes to Twilio Sync Stream
   - Displays conversation messages
