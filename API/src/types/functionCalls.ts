import { ChatCompletionTool } from "openai/resources/chat";

const queryStockInformationFunction: ChatCompletionTool = {
  type: "function",
  function: {
    name: "query_stock",
    description: `Query the shops inventory to search for stock information.
     Call this function when asked to recommend a record, or asked to search for a record, or if asked what we have.
    Example Triggers: "Do you have any x available", "What x records do you have", "Can you check if you have anything by x",
    "Do you have something similar to x", "Find me something I might like", "Recommend me a new album based upon my previous orders"`,
    parameters: {
      type: "object",
      properties: {
        RecordTitle: {
          type: "string",
          description: "The name of an album for a vinyl record",
        },
        Artist: {
          type: "string",
          description:
            "The name of the band who made the album. Format this with capital letters for each word, example: Pink Floyd, The Beatles, Kendrick Lamar",
        },
        Genre: {
          type: "string",
          description:
            "The genre of the album. Format this with capital letters for each word, examples: Hip Hop, Rock, Indie, Prog Rock, Alt Rock, Pop, Trip Hop, Folk Rock, Grunge, Punk. If not directly in this list, match the closest genre",
        },
      },
      additionalProperties: false,
    },
  },
};

export const functionCalls: ChatCompletionTool[] = [
  queryStockInformationFunction,
];
