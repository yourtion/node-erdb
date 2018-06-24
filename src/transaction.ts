import Connection from "./connection";
import { IConnectionPromise } from "./mysql";

export default class Transaction extends Connection {
  private isCommit = false;
  private isRollback = false;

  constructor(conn: IConnectionPromise) {
    super(conn);
  }

  private check() {
    if (this.isCommit || this.isRollback) {
      throw new Error("transaction was commit or rollback");
    }
  }

  public query(sql: string, values?: any) {
    this.check();
    return super.query(sql, values);
  }

  public async commit() {
    this.check();
    try {
      await this.conn.commitAsync();
    } finally {
      this.conn.release();
      this.isCommit = true;
    }
  }

  public async rollback() {
    this.check();
    try {
      await this.conn.rollbackAsync();
    } finally {
      this.conn.release();
      this.isRollback = true;
    }
  }
}
