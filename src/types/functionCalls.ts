import { ChatCompletionTool } from "openai/resources/chat";

const queryStockInformationFunction: ChatCompletionTool = {
  type: "function",
  function: {
    name: "query_stock",
    description: "Query the shops inventory to search for stock information",
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
            "The genre of the album. Format this with capital letters for each word, examples: Hip Hop, Rock, Indie, Prog Rock, Alt Rock, Pop, Trip Hop, Folk Rock, Grunge, Punk",
        },
      },
      additionalProperties: false,
    },
  },
};

export const functionCalls: ChatCompletionTool[] = [
  queryStockInformationFunction,
];
