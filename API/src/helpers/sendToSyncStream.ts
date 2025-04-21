import { Twilio } from "twilio";
export async function sendToSyncStream(
  role: string,
  content: string,
  client: Twilio,
  interrupt?: boolean
): Promise<void> {
  const streamSid = process.env.TWILIO_SYNC_STREAM_SID;
  const syncSid = process.env.TWILIO_SYNC_SERVICE_SID;
  if (!streamSid || !syncSid) {
    throw Error("No Stream Sid in ENV");
  }
  try {
    const streamMessage = await client.sync.v1
      .services(syncSid)
      .syncStreams(streamSid)
      .streamMessages.create({
        data: {
          text: content,
          author: role,
          messageId: "Hi",
          interrupt: interrupt ?? false,
        },
      });
  } catch (e) {
    const err = e as Error;
    throw Error(err.message);
  }
}
