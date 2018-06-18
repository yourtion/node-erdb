/**
 * Literal
 */

export class Literal {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  public static Literal(text: string) {
    if (!(this instanceof Literal)) {
      return new Literal(text);
    }
    this.text = text;
  }

  public toString() {
    return this.text;
  }
}

export const literals = {
  Literal: Literal.Literal,
  now: new Literal("now()"),
};
