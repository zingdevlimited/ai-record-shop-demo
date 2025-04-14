// AI Assisted Azure Table Storage File
import { TableClient, TableEntity, odata } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

export interface QueryFilters {
  partitionKey?: string;
  rowKey?: string;
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

export interface StoreEntity extends TableEntity {
  Address: string;
  City: string;
  County: string;
  Quantity: string;
  rowKey: string;
}

export class TableService {
  private stockTableClient: TableClient;
  private storeTableClient: TableClient;
  private stockTableName: string;
  private storeTableName: string;

  /**
   * Creates an instance of StockTableService for a specific table.
   * Requires AZURE_TABLE_STORAGE_ENDPOINT and AZURE_STOCK_TABLE_NAME
   * environment variables to be set.
   * Uses DefaultAzureCredential for authentication.
   */
  constructor() {
    const endpoint = process.env.AZURE_TABLE_STORAGE_ENDPOINT;
    const stockTableName = process.env.AZURE_STOCK_TABLE_NAME;
    const storeTableName = process.env.AZURE_STORE_TABLE_NAME;

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
    if (!storeTableName) {
      throw new Error(
        "AZURE_STORE_TABLE_NAME environment variable is not set."
      );
    }

    this.stockTableName = stockTableName;
    this.storeTableName = storeTableName;
    console.log(`StockTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.stockTableName}`);
    console.log(`StoreTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.storeTableName}`);

    // Use DefaultAzureCredential for authentication
    const credential = new DefaultAzureCredential();

    // Initialize TableClient directly for the specific stock table
    this.stockTableClient = new TableClient(
      endpoint,
      this.stockTableName,
      credential
    );
    this.storeTableClient = new TableClient(
      endpoint,
      this.storeTableName,
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
  async queryStockEntities<T extends StockEntity>(
    filters: QueryFilters
  ): Promise<T[]> {
    console.log(
      `Querying stock table "${this.stockTableName}" with filters:`,
      filters
    );
    const odataFilter = this.buildODataFilter(filters);
    const results: T[] = [];

    try {
      const entitiesIterator = this.stockTableClient.listEntities<T>({
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

  async getStoreEntity<T extends StoreEntity>(rowKey: string): Promise<T> {
    console.log(
      `Querying Store table "${this.storeTableName}" by row key ${rowKey}`
    );
    try {
      const entity = await this.storeTableClient.getEntity<T>("STORE", rowKey);

      return entity;
    } catch (error) {
      console.error(
        `Error querying stock table "${this.stockTableName}":`,
        error
      );
      throw error;
    }
  }
}
