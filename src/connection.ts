import Operator from "./operator";
import { IConnectionPromise } from "./mysql";

export default class Connection extends Operator {
  protected conn: IConnectionPromise;

  constructor(conn: IConnectionPromise) {
    super();
    this.conn = conn;
  }

  public query(sql: string, values?: any): Promise<any> {
    if (values) {
      sql = this.format(sql, values);
    }
    return this.conn.queryAsync(sql);
  }

  public release() {
    this.conn.release();
  }

  public beginTransaction() {
    return this.conn.beginTransactionAsync();
  }

  public commit() {
    return this.conn.commitAsync();
  }

  public rollback() {
    return this.conn.rollbackAsync();
  }
}
