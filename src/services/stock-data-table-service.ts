// AI Assisted Azure Table Storage File
import { TableClient, TableEntity, odata } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

export interface QueryFilters {
  partitionKey?: string;
  rowKey?: string;
  Artist?: string;
  RecordTitle?: string;
  Genre?: string;
  [key: string]: string | undefined;
}

// Generic entity type, refine if you have a strict 'Stock' entity interface
export interface StockEntity extends TableEntity {
  Artist: string;
  Genre: string;
  Price: string;
  RecordTitle: string;
  Quantity: string;
}

export class StockTableService {
  private tableClient: TableClient;
  private stockTableName: string;

  /**
   * Creates an instance of StockTableService for a specific table.
   * Requires AZURE_TABLE_STORAGE_ENDPOINT and AZURE_STOCK_TABLE_NAME
   * environment variables to be set.
   * Uses DefaultAzureCredential for authentication.
   */
  constructor() {
    const endpoint = process.env.AZURE_TABLE_STORAGE_ENDPOINT;
    const stockTableName = process.env.AZURE_STOCK_TABLE_NAME;

    if (!endpoint) {
      throw new Error(
        "AZURE_TABLE_STORAGE_ENDPOINT environment variable is not set."
      );
    }
    if (!stockTableName) {
      throw new Error(
        "AZURE_STOCK_TABLE_NAME environment variable is not set."
      );
    }

    this.stockTableName = stockTableName;
    console.log(`StockTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.stockTableName}`);

    // Use DefaultAzureCredential for authentication
    const credential = new DefaultAzureCredential();

    // Initialize TableClient directly for the specific stock table
    this.tableClient = new TableClient(
      endpoint,
      this.stockTableName,
      credential
    );

    console.log(
      `StockTableService initialized successfully for table "${this.stockTableName}".`
    );
  }

  /**
   * Builds an OData filter string from a filter object.
   * @param filters - An object containing key-value pairs for filtering.
   * @returns An OData filter string.
   */
  private buildODataFilter(filters: QueryFilters): string {
    const filterParts: string[] = [];
    for (const key in filters) {
      const value = filters[key];
      if (
        Object.prototype.hasOwnProperty.call(filters, key) &&
        value !== undefined &&
        value !== null
      ) {
        // Use odata tagged template literal for proper escaping of different types
        // Handles strings, numbers, booleans, dates etc.
        filterParts.push(odata`${key} eq ${value}`);
      }
    }
    return filterParts.join(" and ");
  }

  /**
   * Queries the stock table for entities matching the provided filters.
   *
   * @template T - The expected shape of the entities
   * @param {QueryFilters} filters - An object containing the properties to filter by
   * @returns {Promise<T[]>} A promise that resolves to an array of matching entities.
   */
  async queryEntities<T extends StockEntity>(
    filters: QueryFilters
  ): Promise<T[]> {
    console.log(
      `Querying stock table "${this.stockTableName}" with filters:`,
      filters
    );
    const odataFilter = this.buildODataFilter(filters);
    const results: T[] = [];

    try {
      const entitiesIterator = this.tableClient.listEntities<T>({
        queryOptions: { filter: odataFilter },
      });

      for await (const entity of entitiesIterator) {
        results.push(entity);
      }

      console.log(
        `Found ${results.length} entities matching filter: ${
          odataFilter || "(no filter)"
        }`
      );
      return results;
    } catch (error) {
      console.error(
        `Error querying stock table "${this.stockTableName}":`,
        error
      );
      throw error;
    }
  }

  /**
   * Adds a new entity to the stock table.
   *
   * @template T - The shape of the entity to add, must include partitionKey and rowKey.
   * @param {T} entity - The entity data to add. Must include partitionKey and rowKey.
   * @returns {Promise<void>} Resolves on success, rejects on error.
   */
  async addEntity<T extends { partitionKey: string; rowKey: string }>(
    entity: T
  ): Promise<void> {
    console.log(
      `Adding entity to stock table "${this.stockTableName}":`,
      entity
    );
    try {
      // TableEntity requires partitionKey and rowKey properties on the object
      // Ensure the input 'entity' already has these defined.
      const tableEntity: TableEntity<T> = { ...entity };
      const result = await this.tableClient.createEntity(tableEntity);
      console.log("Entity added successfully. ETag:", result.etag);
    } catch (error) {
      console.error(
        `Error adding entity to stock table "${this.stockTableName}":`,
        error
      );
      throw error;
    }
  }

  /**
   * Deletes an entity from the stock table.
   * Requires the partitionKey and rowKey of the entity to delete.
   * @param partitionKey The partition key of the entity.
   * @param rowKey The row key of the entity.
   * @returns {Promise<void>}
   */
  async deleteEntity(partitionKey: string, rowKey: string): Promise<void> {
    console.log(
      `Deleting entity from stock table "${this.stockTableName}" with PK='${partitionKey}', RK='${rowKey}'`
    );
    try {
      await this.tableClient.deleteEntity(partitionKey, rowKey);
      console.log("Entity deleted successfully.");
    } catch (error) {
      console.error(
        `Error deleting entity from stock table "${this.stockTableName}":`,
        error
      );
      // Consider checking error type, e.g., if it's a 404 Not Found
      throw error;
    }
  }
}

// --- Example Usage ---
/*
// Ensure environment variables AZURE_TABLE_STORAGE_ENDPOINT and
// AZURE_STOCK_TABLE_NAME are set before running this example.

async function main() {
  try {
      const service = new StockTableService(); // No table name needed here

      // Example 1: Define a stock entity using the specific interface
      const newStock: StockEntity = {
          partitionKey: "NASDAQ", // Example partition key (e.g., Exchange)
          rowKey: "MSFT",       // Example row key (e.g., Ticker Symbol)
          TickerSymbol: "MSFT",
          CompanyName: "Microsoft Corp",
          LastPrice: 300.50,
          Timestamp: new Date()
          // etag and timestamp are added by Azure Tables service automatically
      };

      // Example 2: Add the entity (uncomment to run)
      // await service.addEntity(newStock);
      // console.log(`Entity ${newStock.rowKey} added.`);

      // Example 3: Query by Partition Key and a custom property
      const queryFilters: QueryFilters = {
          partitionKey: "NASDAQ",
          TickerSymbol: "MSFT", // Filter by a stock-specific property
      };
      // Explicitly type the expected return if using a specific interface
      const records: StockEntity[] = await service.queryEntities<StockEntity>(queryFilters);

      console.log("\nQuery Results:");
      if (records.length > 0) {
           records.forEach((record, index) => {
              console.log(`--- Record ${index + 1} ---`);
              console.log("  Partition Key:", record.partitionKey);
              console.log("  Row Key:", record.rowKey);
              console.log("  Ticker:", record.TickerSymbol);
              console.log("  Company:", record.CompanyName);
              console.log("  Price:", record.LastPrice);
              console.log("  Azure Timestamp:", record.timestamp); // Azure metadata timestamp
              console.log("  ETag:", record.etag);
              console.log("------------------");
          });
      } else {
          console.log("No records found matching the criteria.");
      }

      // Example 4: Delete an entity (uncomment to run)
      // await service.deleteEntity("NASDAQ", "MSFT");
      // console.log("Attempted to delete MSFT entity.");

  } catch (error) {
      console.error("\n--- An error occurred ---");
      console.error(error);
  }
}

// Uncomment the line below to run the example
// main();
*/
