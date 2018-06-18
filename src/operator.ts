import { literals, Literal } from "./literal";

export interface IKVObject<T = any> {
  [key: string]: T;
}

export interface IDBOptions {
  /** query condition object */
  where?: IDBWhere;
  /** select columns, default is `'*'` */
  columns?: string | string[];
  /** result rows sort condition */
  orders?: IDBOrder;
  /** result limit count, default is no limit */
  limit?: number;
  /** result offset, default is `0` */
  offset?: number;
}

export type IDBWhere = IKVObject<string | string[]> | null;
export type IDBOrder = string | Array<number | null | string | string[]>;

export const SqlString = require("mysql/lib/protocol/SqlString");
if (!SqlString.__escape) {
  SqlString.__escape = SqlString.escape;
  SqlString.escape = (val: any, stringifyObjects?: boolean, timeZone?: string) => {
    if (val instanceof Literal) {
      return val.toString();
    }
    return SqlString.__escape(val, stringifyObjects, timeZone);
  };
}

export default abstract class Operator {
  public abstract query(sql: string, values?: any): Promise<any>;

  public literals = literals;

  public escape(val: any, stringifyObjects?: boolean, timeZone?: string) {
    return SqlString.escape(val, stringifyObjects, timeZone);
  }

  public escapeId(value: string, forbidQualified?: boolean) {
    return SqlString.escapeId(value, forbidQualified);
  }

  protected format(sql: string, values: any, stringifyObjects?: boolean, timeZone?: string) {
    // if values is object, not null, not Array;
    if (!Array.isArray(values) && typeof values === "object" && values !== null) {
      // object not support replace column like ??;
      return sql.replace(/\:(\w+)/g, (txt, key) => {
        if (values.hasOwnProperty(key)) {
          return SqlString.escape(values[key]);
        }
        // if values don't hasOwnProperty, return origin txt;
        return txt;
      });
    }
    return SqlString.format(sql, values, stringifyObjects, timeZone);
  }

  protected where(where?: IDBWhere) {
    if (!where) {
      return "";
    }

    const wheres = [];
    const values = [];
    // tslint:disable-next-line:forin
    for (const key in where) {
      const value = where[key];
      if (Array.isArray(value)) {
        wheres.push("?? IN (?)");
      } else {
        wheres.push("?? = ?");
      }
      values.push(key);
      values.push(value);
    }
    if (wheres.length > 0) {
      return this.format(" WHERE " + wheres.join(" AND "), values);
    }
    return "";
  }

  public selectColumns(table: string, columns: string | string[] = "*") {
    let sql;
    if (columns === "*") {
      sql = this.format("SELECT * FROM ??", [table]);
    } else {
      sql = this.format("SELECT ?? FROM ??", [columns, table]);
    }
    return sql;
  }

  public orders(orders?: IDBOrder) {
    if (!orders) {
      return "";
    }
    if (typeof orders === "string") {
      orders = [orders];
    }
    const values = [];
    for (const value of orders) {
      if (typeof value === "string") {
        values.push(this.escapeId(value));
      } else if (Array.isArray(value)) {
        // value format: ['name', 'desc'], ['name'], ['name', 'asc']
        let sort: string | null = String(value[1]).toUpperCase();
        if (sort !== "ASC" && sort !== "DESC") {
          sort = null;
        }
        if (sort) {
          values.push(this.escapeId(value[0]) + " " + sort);
        } else {
          values.push(this.escapeId(value[0]));
        }
      }
    }
    return " ORDER BY " + values.join(", ");
  }

  public limit(limit?: number, offset?: number) {
    if (!limit || typeof limit !== "number") {
      return "";
    }
    if (typeof offset !== "number") {
      offset = 0;
    }
    return " LIMIT " + offset + ", " + limit;
  }

  public queryOne(sql: string, values?: any) {
    return this.query(sql, values).then(rows => (rows && rows[0]) || null);
  }

  public count(table: string, where?: any) {
    const sql = this.format("SELECT COUNT(*) as count FROM ??", [table]) + this.where(where);
    // debug('count(%j, %j) \n=> %j', table, where, sql);
    return this.query(sql).then((rows: any[]) => rows && rows[0] && rows[0].count);
  }

  public select(table: string, options: IDBOptions = {}) {
    const sql =
      this.selectColumns(table, options.columns) +
      this.where(options.where) +
      this.orders(options.orders) +
      this.limit(options.limit, options.offset);
    // debug("select(%j, %j) \n=> %j", table, options, sql);
    return this.query(sql);
  }
  public get(table: string, where?: IDBWhere, options: IDBOptions = {}) {
    options.where = where;
    options.limit = 1;
    options.offset = 0;
    return this.select(table, options).then((rows: any[]) => (rows && rows[0]) || null);
  }

  public insert(table: string, rows: any, options?: IDBOptions) {
    options = options || {};
    let firstObj;
    // insert(table, rows)
    if (Array.isArray(rows)) {
      firstObj = rows[0];
    } else {
      // insert(table, row)
      firstObj = rows;
      rows = [rows];
    }
    if (!options.columns) {
      options.columns = Object.keys(firstObj);
    }

    const params = [table, options.columns];
    const strs = [];
    for (const row of rows) {
      const values = [];
      for (const column of options.columns) {
        values.push(row[column]);
      }
      strs.push("(?)");
      params.push(values);
    }

    const sql = this.format("INSERT INTO ??(??) VALUES" + strs.join(", "), params);
    // debug('insert(%j, %j, %j) \n=> %j', table, rows, options, sql);
    return this.query(sql);
  }

  public update(table: string, row: any, options?: IDBOptions) {
    // TODO: support multi rows
    options = options || {};
    if (!options.columns) {
      options.columns = Object.keys(row);
    }
    if (!options.where) {
      if (!("id" in row)) {
        throw new Error("Can not auto detect update condition, please set options.where, or make sure obj.id exists");
      }
      options.where = {
        id: row.id,
      };
    }

    const sets = [];
    const values = [];
    for (const column of options.columns) {
      if (column in options.where) {
        continue;
      }
      sets.push("?? = ?");
      values.push(column);
      values.push(row[column]);
    }
    const sql =
      this.format("UPDATE ?? SET ", [table]) + this.format(sets.join(", "), values) + this.where(options.where);
    // debug('update(%j, %j, %j) \n=> %j', table, row, options, sql);
    return this.query(sql);
  }

  public delete(table: string, where?: IDBWhere) {
    const sql = this.format("DELETE FROM ??", [table]) + this.where(where);
    // debug('delete(%j, %j) \n=> %j', table, where, sql);
    return this.query(sql);
  }
}
