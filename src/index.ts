import { PoolConfig } from "mysql";
import { createMySQL, IPoolPromise } from "./mysql";
import Operator from "./operator";
import Connection from "./connection";
import Transaction from "./transaction";

const Pool = require("mysql/lib/Pool");

export type TransactionScope = (tran: Transaction) => Promise<any>;
export interface ITransactionCTX {
  _transactionConnection?: Transaction | null;
  _transactionScopeCount?: number;
}

export default class ERDB extends Operator {
  private pool: IPoolPromise;

  constructor(conn: IPoolPromise | string | PoolConfig) {
    super();
    if (conn instanceof Pool) {
      this.pool = conn as IPoolPromise;
    } else {
      this.pool = createMySQL(conn as any);
    }
  }

  public query(sql: string, values?: any): Promise<any> {
    if (values) {
      sql = this.format(sql, values);
    }
    return this.pool.queryAsync(sql);
  }

  public getConnection() {
    return this.pool.getConnectionAsync().then(conn => new Connection(conn));
  }

  public async beginTransaction() {
    const conn = await this.pool.getConnectionAsync();
    try {
      await conn.beginTransactionAsync();
    } catch (err) {
      conn.release();
      throw err;
    }
    return new Transaction(conn);
  }

  public async beginTransactionScope(scope: TransactionScope, ctx = {} as ITransactionCTX) {
    if (!ctx._transactionConnection) {
      ctx._transactionConnection = await this.beginTransaction();
      ctx._transactionScopeCount = 1;
    } else {
      ctx._transactionScopeCount! += 1;
    }
    const tran = ctx._transactionConnection;
    try {
      const result = await scope(tran);
      ctx._transactionScopeCount! -= 1;
      if (ctx._transactionScopeCount === 0) {
        ctx._transactionConnection = null;
        await tran!.commit();
      }
      return result;
    } catch (err) {
      if (ctx._transactionConnection) {
        ctx._transactionConnection = null;
        await tran!.rollback();
      }
      throw err;
    }
  }

  public end() {
    return this.pool.endAsync();
  }
}
