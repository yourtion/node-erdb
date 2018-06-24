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
    // debug('query %j', sql);
    return this.conn.queryAsync(sql);
  }

  public release() {
    this.conn.release();
  }

  public beginTransaction() {
    return this.conn.beginTransaction();
  }

  public commit() {
    return this.conn.commit();
  }

  public rollback() {
    return this.conn.rollback();
  }
}
