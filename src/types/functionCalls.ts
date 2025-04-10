import { ChatCompletionTool } from "openai/resources/chat";

const queryStockInformationFunction: ChatCompletionTool = {
  type: "function",
  function: {
    name: "query_stock",
    description: "Query the shops inventory to search for stock information",
    parameters: {
      type: "object",
      properties: {
        RecordName: {
          type: "string",
          description: "The name of an album for a vinyl record",
        },
        BandName: {
          type: "string",
          description: "The name of the band who made the album",
        },
        Genre: {
          type: "string",
          description: "The genre of the album",
        },
      },
      additionalProperties: false,
    },
  },
};

export const functionCalls: ChatCompletionTool[] = [
  queryStockInformationFunction,
];
