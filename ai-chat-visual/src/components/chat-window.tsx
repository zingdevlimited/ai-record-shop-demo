// src/components/SyncStreamComponent.tsx
import React, { useState, useEffect, useRef } from "react";
import { SyncClient, SyncStream, SyncStreamMessage } from "twilio-sync";
import TypewriterText from "./typerwriter";

// Define a simple interface for the expected data structure within the stream messages
// Adjust this based on the actual shape of your data
interface MyStreamMessageData {
  text: string;
  author: string;
  messageId: string;
  interrupt?: boolean;
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
          `https://ashley-butter-secondary-models.trycloudflare.com/GetToken?identity=WebApp`,
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
            const incomingData = event.message
              .data as Partial<MyStreamMessageData> & { interrupt?: boolean };

            // Check if the *incoming* data signifies an interrupt
            if (incomingData.interrupt === true) {
              // --- Handle Interrupt Signal ---
              setMessages((prevMessages) => {
                // Check if there are any messages currently in the state
                if (prevMessages.length === 0) {
                  console.warn(
                    "Received interrupt signal but there are no messages to interrupt."
                  );
                  return prevMessages; // No change needed, return the existing state
                }

                // Create a new array containing all messages EXCEPT the last one
                const messagesBeforeLast = prevMessages.slice(0, -1);

                // Get a reference to the original last message
                const lastMessage = prevMessages[prevMessages.length - 1];

                // Create a *new* object for the last message, copying its properties
                // and setting the interrupt flag to true.
                const interruptedLastMessage: MyStreamMessageData = {
                  ...lastMessage, // Spread existing properties
                  interrupt: true, // Set the interrupt flag
                };

                // Return the new state array: the messages before the last, plus the modified last one
                return [...messagesBeforeLast, interruptedLastMessage];
              });
            } else {
              const newMessage = incomingData as MyStreamMessageData;

              setMessages((prevMessages) => [...prevMessages, newMessage]);
            }
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
  console.log(messages);
  return (
    // The outer div with margin
    <div style={{ margin: "20px" }}>
      <h2>Conversation Relay</h2>
      {messages.length === 0 ? (
        <p>Waiting for messages...</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {messages.map((msg, index) => {
            const messageKey = index; // Unique key for the message

            return (
              <li
                key={messageKey} // Use the same key here
                style={{
                  /* ... your li styles ... */ display: "flex",
                  marginBottom: "10px",
                  maxWidth: "75%",
                  wordWrap: "break-word",
                  alignSelf:
                    msg.author === "System" ? "flex-start" : "flex-end",
                  marginLeft: msg.author === "System" ? "0" : "auto",
                  marginRight: msg.author === "System" ? "auto" : "0",
                }}
                // Example: Add an onClick to the list item to interrupt it
                // onClick={() => handleInterrupt(messageKey)}
              >
                <div
                  style={{
                    /* ... your bubble styles ... */ padding: "8px 12px",
                    borderRadius: "15px",
                    textAlign: "left",
                    backgroundColor:
                      msg.author === "System" ? "#f1f0f0" : "#007bff",
                    color: msg.author === "System" ? "#333" : "white",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "3px",
                    }}
                  >
                    {msg.author === "System"
                      ? "System:"
                      : (msg.author || "User") + ":"}
                  </span>

                  {/* === Pass the interrupt prop === */}
                  {msg.author === "System" ? (
                    <TypewriterText
                      text={msg.text}
                      speed={30}
                      interrupt={msg.interrupt ?? false} // Pass the interrupt state
                    />
                  ) : (
                    <span>{msg.text}</span>
                  )}

                  {/* ============================== */}

                  <br />
                  <small
                    style={{
                      /* ... your small styles ... */
                      color: msg.author === "System" ? "gray" : "#e0e0e0",
                      fontSize: "0.75em",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {/* Timestamp placeholder */}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {/* <PublishMessageComponent stream={syncStreamRef.current} /> */}
    </div>
  );
};

export default SyncStreamComponent;
