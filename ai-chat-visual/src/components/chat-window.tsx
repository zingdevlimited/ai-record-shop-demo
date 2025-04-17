// src/components/SyncStreamComponent.tsx
import React, { useState, useEffect, useRef } from "react";
import { SyncClient, SyncStream, SyncStreamMessage } from "twilio-sync";

// Define a simple interface for the expected data structure within the stream messages
// Adjust this based on the actual shape of your data
interface MyStreamMessageData {
  text: string;
  author: string;
  messageId: string;
}

// Define the structure of a StreamMessage with our specific data type
interface MySyncStreamMessage extends SyncStreamMessage {
  data: MyStreamMessageData;
}

// Props for the component
interface SyncStreamComponentProps {
  streamNameOrSid: string; // Pass the unique name or SID of the stream
  identity: string; // Unique identity for the Sync client token
}

const SyncStreamComponent: React.FC<SyncStreamComponentProps> = ({
  streamNameOrSid,
  identity,
}) => {
  // State now holds an array of received messages
  const [messages, setMessages] = useState<MyStreamMessageData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const syncClientRef = useRef<SyncClient | null>(null);
  const syncStreamRef = useRef<SyncStream | null>(null);

  useEffect(() => {
    let client: SyncClient | null = null;
    let stream: SyncStream | null = null;

    const initializeSync = async () => {
      setIsLoading(true);
      setError(null);
      setMessages([]); // Clear previous messages on re-init
      console.log("Initializing Twilio Sync for Stream...");

      try {
        // --- 1. Fetch Access Token (Same as before) ---
        const response = await fetch(
          `https://dinner-cliff-premises-realm.trycloudflare.com/GetToken?identity=WebApp`,
          {
            method: "GET",
          }
        );

        if (!response.ok) {
          // Try to get error details from response body
          let errorBody = "Unknown error";
          try {
            const errData = await response.json();
            errorBody = errData.error || response.statusText;
          } catch (e) {
            /* ignore parsing error */
          }
          throw new Error(
            `Failed to fetch token: ${response.status} ${errorBody}`
          );
        }

        const data = await response.json();
        const token = data.token;

        if (!token) {
          throw new Error("No token received from server");
        }
        console.log("Token fetched successfully.");

        // --- 2. Initialize Sync Client (Same as before) ---
        client = new SyncClient(token);
        syncClientRef.current = client;

        client.on("connectionStateChanged", (state) => {
          console.log(`Sync connection state changed to: ${state}`);
          // Add similar connection state handling as before (optional)
          if (state === "error") {
            setError("Sync connection error.");
          }
          if (state === "connected") {
            setError(null); // Clear error on successful connection/reconnection
          }
        });

        client.on("tokenAboutToExpire", async () => {
          console.log("Sync token about to expire. Fetching new token...");
          try {
            // Adjust fetch details as needed for your endpoint
            const newTokenResponse = await fetch(
              `/api/sync-token?identity=${identity}`
            );
            if (!newTokenResponse.ok)
              throw new Error("Failed to refresh token");
            const { token: refreshedToken } = await newTokenResponse.json();
            client?.updateToken(refreshedToken);
            console.log("Sync token updated.");
          } catch (err) {
            console.error("Error refreshing Sync token:", err);
            setError("Failed to refresh Sync token. Connection may be lost.");
          }
        });

        console.log("Sync Client initialized.");

        // --- 3. Get the Sync Stream ---
        stream = await client.stream(streamNameOrSid);
        syncStreamRef.current = stream;
        console.log(
          `Subscribed to Sync Stream: ${stream.uniqueName || stream.sid}`
        );

        // --- 4. Subscribe to Stream Events ---
        // Note: There's no equivalent of getItems() for streams via SDK.
        // You subscribe and receive messages published *after* subscribing.
        // If you need historical messages, you'd typically fetch them via
        // the Twilio REST API separately (e.g., during initialization).

        stream.on(
          "messagePublished",
          (event: { message: SyncStreamMessage; isLocal: boolean }) => {
            console.log(
              "Message Published:",
              event.message.sid,
              event.message.data
            );
            const newMessage = event.message.data as MyStreamMessageData;
            // Append the newly received message data to our state
            setMessages((prevMessages) => [...prevMessages, newMessage]);
          }
        );

        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing Twilio Sync Stream:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setIsLoading(false);
      }
    };
    initializeSync();

    // --- 5. Cleanup Function ---
    return () => {
      console.log("Cleaning up Sync Stream component...");
      if (stream) {
        // Remove the messagePublished listener
        stream.removeAllListeners("messagePublished");
        // stream.close(); // Close the stream instance if desired
        console.log("Removed stream listeners.");
      }
      if (client) {
        // Shut down the client gracefully
        client.shutdown();
        console.log("Sync Client shutdown.");
      }
      syncClientRef.current = null;
      syncStreamRef.current = null;
    };
    // Re-run effect if stream name or identity changes
  }, [streamNameOrSid, identity]);

  // --- Render Logic ---
  if (isLoading) {
    return <div>Connecting to Sync Stream...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }
  return (
    <div>
      <h2>Sync Stream Messages ({streamNameOrSid})</h2>
      {messages.length === 0 ? (
        <p>Waiting for messages...</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {messages.map((msg, index) => (
            // Use a unique message SID if available from your data, otherwise index (less ideal)
            <li
              key={index}
              style={{
                marginBottom: "10px",
                borderBottom: "1px solid #eee",
                paddingBottom: "5px",
              }}
            >
              {/* Render your message data */}
              <span style={{ fontWeight: "bold" }}>
                {msg.author || "System"}:{" "}
              </span>
              <span>{msg.text}</span>
              <br />
              <small style={{ color: "gray" }}></small>
            </li>
          ))}
        </ul>
      )}
      {/* Example: Add an input to publish messages (requires more logic) */}
      {/* <PublishMessageComponent stream={syncStreamRef.current} /> */}
    </div>
  );
};

export default SyncStreamComponent;
