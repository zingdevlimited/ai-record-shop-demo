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
  Name: string;
  PhoneNumber: string;
  rowKey: string;
}
export interface CustomerEntity extends TableEntity {
  Address: string;
  City: string;
  County: string;
  CustomerName: string;
  PhoneNumber: string;
  rowKey: string;
}
export interface OrderEntity extends TableEntity {
  ItemID: string;
  Price: string;
  rowKey: string;
}

export class TableService {
  private stockTableClient: TableClient;
  private storeTableClient: TableClient;
  private customerTableClient: TableClient;
  private orderTableClient: TableClient;
  private stockTableName: string;
  private storeTableName: string;
  private customerTableName: string;
  private orderTableName: string;

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
    const customerTableName = process.env.AZURE_CUSTOMER_TABLE_NAME;
    const orderTableName = process.env.AZURE_ORDER_TABLE_NAME;

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
    if (!customerTableName) {
      throw new Error(
        "AZURE_CUSTOMER_TABLE_NAME environment variable is not set."
      );
    }
    if (!orderTableName) {
      throw new Error(
        "AZURE_ORDER_TABLE_NAME environment variable is not set."
      );
    }

    this.stockTableName = stockTableName;
    this.storeTableName = storeTableName;
    this.customerTableName = customerTableName;
    this.orderTableName = orderTableName;
    console.log(`StockTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.stockTableName}`);
    console.log(`StoreTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.storeTableName}`);
    console.log(`CustomerTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.customerTableName}`);
    console.log(`OrderTableService initializing...`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Table Name: ${this.orderTableName}`);

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
    this.customerTableClient = new TableClient(
      endpoint,
      this.customerTableName,
      credential
    );
    this.orderTableClient = new TableClient(
      endpoint,
      this.orderTableName,
      credential
    );

    console.log(
      `StockTableService initialized successfully for table "${this.stockTableName}","${this.storeTableName}",
      "${this.customerTableName}" and "${this.orderTableName}".`
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
    return filterParts.join(" or ");
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

  async listStoreEntity<T extends StoreEntity>(): Promise<T[]> {
    console.log(`List all stores in table "${this.storeTableName}"`);
    try {
      const entities = this.storeTableClient.listEntities<T>();
      const results: T[] = [];
      for await (const entity of entities) {
        results.push(entity);
      }
      return results;
    } catch (error) {
      console.error(
        `Error querying stock table "${this.stockTableName}":`,
        error
      );
      throw error;
    }
  }

  async getCustomerByPhoneNumber<T extends CustomerEntity>(
    filters: QueryFilters,
    PhoneNumber: string
  ): Promise<CustomerEntity | undefined> {
    console.log(
      `Querying customer table "${this.customerTableName}" with filters:`,
      filters
    );
    const odataFilter = this.buildODataFilter(filters);

    try {
      const entitiesIterator = this.customerTableClient.listEntities<T>({
        queryOptions: { filter: odataFilter },
      });
      let toReturn: CustomerEntity | undefined = undefined;
      for await (const entity of entitiesIterator) {
        if (entity.PhoneNumber === PhoneNumber) {
          toReturn = {
            Address: entity.Address,
            City: entity.City,
            County: entity.County,
            CustomerName: entity.CustomerName,
            partitionKey: entity.partitionKey,
            PhoneNumber: entity.PhoneNumber,
            rowKey: entity.rowKey,
          };
        }
      }
      console.log(`Found ${toReturn?.CustomerName} Customer`);
      return toReturn;
    } catch (error) {
      console.error(
        `Error querying stock table "${this.stockTableName}":`,
        error
      );
      throw error;
    }
  }

  async getCustomerOrders<T extends OrderEntity>(
    partitionKey: string
  ): Promise<{ orders: OrderEntity[]; stock: StockEntity[] }> {
    console.log(`Getting Orders for customer: ${partitionKey}`);

    try {
      const odataFilter = this.buildODataFilter({ PartitionKey: partitionKey });
      const results: OrderEntity[] = [];
      let customerOrders: StockEntity[] = [];

      const entitiesIterator = this.orderTableClient.listEntities<OrderEntity>({
        queryOptions: { filter: odataFilter },
      });
      for await (const entity of entitiesIterator) {
        const stockODataFilter = this.buildODataFilter({
          RowKey: entity.ItemID,
        });

        console.log(`Getting relevant Stock Entities for ${entity.ItemID}`);
        const StockEntities = this.stockTableClient.listEntities<StockEntity>({
          queryOptions: { filter: stockODataFilter },
        });
        for await (const stockEntity of StockEntities) {
          customerOrders.push(stockEntity);
        }

        results.push(entity);
      }
      return { orders: results, stock: customerOrders };
    } catch (error) {
      console.error(
        `Error querying stock table "${this.stockTableName}":`,
        error
      );
      throw error;
    }
  }
}
