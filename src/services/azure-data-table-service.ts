// import { TableClient, odata } from "@azure/data-tables";
// import { DefaultAzureCredential } from "@azure/identity";

// interface TableEntity {
//   partitionKey: string;
//   rowKey: string;
//   [key: string]: any; // Allow other dynamic properties
// }

// class AzureDataTableService {
//   private tableClient: TableClient;

//   constructor(tableName: string) {
//     const credential = new DefaultAzureCredential();
//     this.tableClient = new TableClient(
//       `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.table.core.windows.net`,
//       tableName,
//       credential
//     );
//   }

//   /**
//    * Retrieves a single entity from the Azure Table based on partition and row keys.
//    * @param partitionKey The partition key of the entity.
//    * @param rowKey The row key of the entity.
//    * @returns A Promise that resolves to the entity if found, otherwise undefined.
//    */
//   async getEntity<T extends TableEntity>(
//     partitionKey: string,
//     rowKey: string
//   ): Promise<T | undefined> {
//     try {
//       const result = await this.tableClient.getEntity<T>(partitionKey, rowKey);
//       return result;
//     } catch (error: any) {
//       if (error.statusCode === 404) {
//         return undefined; // Entity not found
//       }
//       console.error("Error retrieving entity:", error);
//       throw error;
//     }
//   }

//   /**
//    * Queries entities from the Azure Table based on an optional filter.
//    * @param filter An optional OData filter string (e.g., "BandName eq 'The Beatles'").
//    * @returns A Promise that resolves to an array of entities matching the filter.
//    */
//   async queryEntities<T extends TableEntity>(filter?: string): Promise<T[]> {
//     const entities: T[] = [];
//     try {
//       const iterator = this.tableClient.listEntities<T>({
//         queryOptions: { filter: filter ?? undefined },
//       });

//       for await (const page of iterator.byPage()) {
//         entities.push(...page);
//       }
//       return entities;
//     } catch (error) {
//       console.error("Error querying entities:", error);
//       throw error;
//     }
//   }

//   /**
//    * Queries entities from the Azure Table with optional top and select clauses.
//    * @param top The maximum number of entities to return.
//    * @param select An array of property names to select (e.g., ["RecordName", "Genre"]).
//    * @returns A Promise that resolves to an array of entities.
//    */
//   async queryEntitiesWithProjection<T extends TableEntity>(
//     top?: number,
//     select?: (keyof T)[]
//   ): Promise<Partial<T>[]> {
//     const entities: Partial<T>[] = [];
//     try {
//       const iterator = this.tableClient.listEntities<Partial<T>>({

//         top: top,
//         select: select as string[] | undefined,
//       });

//       for await (const page of iterator.byPage()) {
//         entities.push(...page);
//       }
//       return entities;
//     } catch (error) {
//       console.error("Error querying entities with projection:", error);
//       throw error;
//     }
//   }
// }
