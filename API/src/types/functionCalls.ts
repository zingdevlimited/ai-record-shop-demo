import { ChatCompletionTool } from "openai/resources/chat";

const queryStockInformationFunction: ChatCompletionTool = {
  type: "function",
  function: {
    name: "query_stock",
    description:
      "Use this function whenever a user asks about the availability, stock, or whether the shop carries/sells vinyl records. This includes inquiries about specific artists, album titles, or genres. This is the primary tool to determine if a record is in the shop's inventory. Examples: 'Do you have Taylor Swift?', 'Is Dark Side of the Moon in stock?', 'What Rock vinyl do you sell?'.",
    parameters: {
      type: "object",
      properties: {
        RecordTitle: {
          type: "string",
          description:
            "The name of an album for a vinyl record. Provide if the user specifies an album title.",
        },
        Artist: {
          type: "string",
          description:
            "The name of the band or artist. Extract this if the user mentions an artist. Format with capital letters for each word (e.g., Pink Floyd, The Beatles, Kendrick Lamar, Taylor Swift).",
        },
        Genre: {
          type: "string",
          description:
            "The genre of the album or artist. Extract this if the user mentions a genre. Format with capital letters for each word (e.g.,  Hip Hop, Rock, Indie, Prog Rock, Alt Rock, Pop, Trip Hop, Folk Rock, Grunge, Punk). If not explicitly mentioned but inferable, use the closest match from common genres.",
        },
      },
      additionalProperties: false,
    },
  },
};

export const functionCalls: ChatCompletionTool[] = [
  queryStockInformationFunction,
];
