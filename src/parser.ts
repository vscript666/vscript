import { Token, TokenType } from './lexer';

// AST 节点类型
export interface Expr {
  accept<T>(visitor: ExprVisitor<T>): T;
}

export interface Stmt {
  accept<T>(visitor: StmtVisitor<T>): T;
}

// 访问者模式接口
export interface ExprVisitor<T> {
  visitBinaryExpr(expr: Binary): T;
  visitGroupingExpr(expr: Grouping): T;
  visitLiteralExpr(expr: Literal): T;
  visitUnaryExpr(expr: Unary): T;
  visitVariableExpr(expr: Variable): T;
  visitAssignExpr(expr: Assign): T;
  visitCallExpr(expr: Call): T;
  visitArrayExpr(expr: Array): T;
}

export interface StmtVisitor<T> {
  visitExpressionStmt(stmt: Expression): T;
  visitFunctionStmt(stmt: Function): T;
  visitIfStmt(stmt: If): T;
  visitLetStmt(stmt: Let): T;
  visitReturnStmt(stmt: Return): T;
  visitWhileStmt(stmt: While): T;
  visitBlockStmt(stmt: Block): T;
  visitForStmt(stmt: For): T;
}

// 表达式节点类型
export class Binary implements Expr {
  constructor(
    public left: Expr,
    public operator: Token,
    public right: Expr
  ) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitBinaryExpr(this);
  }
}

export class Grouping implements Expr {
  constructor(public expression: Expr) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitGroupingExpr(this);
  }
}

export class Literal implements Expr {
  constructor(public value: any) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitLiteralExpr(this);
  }
}

export class Unary implements Expr {
  constructor(
    public operator: Token,
    public right: Expr
  ) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitUnaryExpr(this);
  }
}

export class Variable implements Expr {
  constructor(public name: Token) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitVariableExpr(this);
  }
}

export class Assign implements Expr {
  constructor(
    public name: Token,
    public value: Expr
  ) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitAssignExpr(this);
  }
}

export class Call implements Expr {
  constructor(
    public callee: Expr,
    public paren: Token,
    public args: Expr[]
  ) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitCallExpr(this);
  }
}

export class Array implements Expr {
  constructor(public elements: Expr[]) {}

  accept<T>(visitor: ExprVisitor<T>): T {
    return visitor.visitArrayExpr(this);
  }
}

// 语句节点类型
export class Expression implements Stmt {
  constructor(public expression: Expr) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitExpressionStmt(this);
  }
}

export class Function implements Stmt {
  constructor(
    public name: Token,
    public params: Token[],
    public body: Stmt[]
  ) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitFunctionStmt(this);
  }
}

export class If implements Stmt {
  constructor(
    public condition: Expr,
    public thenBranch: Stmt,
    public elseBranch: Stmt | null
  ) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitIfStmt(this);
  }
}

export class Let implements Stmt {
  constructor(
    public name: Token,
    public initializer: Expr | null
  ) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitLetStmt(this);
  }
}

export class Return implements Stmt {
  constructor(
    public keyword: Token,
    public value: Expr | null
  ) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitReturnStmt(this);
  }
}

export class While implements Stmt {
  constructor(
    public condition: Expr,
    public body: Stmt
  ) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitWhileStmt(this);
  }
}

export class Block implements Stmt {
  constructor(public statements: Stmt[]) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitBlockStmt(this);
  }
}

export class For implements Stmt {
  constructor(
    public variable: Token,
    public iterable: Expr,
    public body: Stmt
  ) {}

  accept<T>(visitor: StmtVisitor<T>): T {
    return visitor.visitForStmt(this);
  }
}

// 语法分析器类
export class Parser {
  private current = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.isAtEnd()) {
      statements.push(this.declaration());
    }
    return statements;
  }

  private declaration(): Stmt {
    try {
      if (this.match(TokenType.FUNCTION)) return this.function();
      if (this.match(TokenType.LET)) return this.letDeclaration();
      return this.statement();
    } catch (error) {
      this.synchronize();
      throw error;
    }
  }

  private function(): Stmt {
    const name = this.consume(TokenType.IDENTIFIER, "需要函数名");
    this.consume(TokenType.LEFT_PAREN, "函数名后需要 '('");
    
    const parameters: Token[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        if (parameters.length >= 255) {
          throw this.error(this.peek(), "函数参数不能超过 255 个");
        }
        parameters.push(this.consume(TokenType.IDENTIFIER, "需要参数名"));
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RIGHT_PAREN, "参数列表后需要 ')'");
    this.consume(TokenType.LEFT_BRACE, "函数体需要 '{'");
    const body = this.block();
    return new Function(name, parameters, body);
  }

  private letDeclaration(): Stmt {
    const name = this.consume(TokenType.IDENTIFIER, "需要变量名");
    let initializer = null;
    
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.expression();
    }

    return new Let(name, initializer);
  }

  private statement(): Stmt {
    if (this.match(TokenType.IF)) return this.ifStatement();
    if (this.match(TokenType.FOR)) return this.forStatement();
    if (this.match(TokenType.RETURN)) return this.returnStatement();
    if (this.match(TokenType.LEFT_BRACE)) return new Block(this.block());

    return this.expressionStatement();
  }

  private ifStatement(): Stmt {
    this.consume(TokenType.LEFT_PAREN, "'如果' 后需要 '('");
    const condition = this.expression();
    this.consume(TokenType.RIGHT_PAREN, "条件后需要 ')'");

    const thenBranch = this.statement();
    let elseBranch = null;
    if (this.match(TokenType.ELSE)) {
      elseBranch = this.statement();
    }

    return new If(condition, thenBranch, elseBranch);
  }

  private forStatement(): Stmt {
    const variable = this.consume(TokenType.IDENTIFIER, "需要循环变量名");
    this.consume(TokenType.IN, "需要关键字 '在'");
    const iterable = this.expression();
    const body = this.statement();

    return new For(variable, iterable, body);
  }

  private returnStatement(): Stmt {
    const keyword = this.previous();
    let value = null;
    if (!this.check(TokenType.RIGHT_BRACE)) {
      value = this.expression();
    }

    return new Return(keyword, value);
  }

  private expressionStatement(): Stmt {
    const expr = this.expression();
    return new Expression(expr);
  }

  private block(): Stmt[] {
    const statements: Stmt[] = [];

    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      statements.push(this.declaration());
    }

    this.consume(TokenType.RIGHT_BRACE, "代码块需要 '}'");
    return statements;
  }

  private expression(): Expr {
    return this.assignment();
  }

  private assignment(): Expr {
    const expr = this.or();

    if (this.match(TokenType.ASSIGN)) {
      const equals = this.previous();
      const value = this.assignment();

      if (expr instanceof Variable) {
        return new Assign(expr.name, value);
      }

      throw this.error(equals, "无效的赋值目标");
    }

    return expr;
  }

  private or(): Expr {
    let expr = this.and();

    while (this.match(TokenType.OR)) {
      const operator = this.previous();
      const right = this.and();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private and(): Expr {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous();
      const right = this.equality();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();

    while (this.match(TokenType.NOT_EQUAL, TokenType.EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private comparison(): Expr {
    let expr = this.term();

    while (this.match(
      TokenType.GREATER,
      TokenType.GREATER_EQUAL,
      TokenType.LESS,
      TokenType.LESS_EQUAL
    )) {
      const operator = this.previous();
      const right = this.term();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private term(): Expr {
    let expr = this.factor();

    while (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const operator = this.previous();
      const right = this.factor();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private factor(): Expr {
    let expr = this.unary();

    while (this.match(TokenType.DIVIDE, TokenType.MULTIPLY, TokenType.MODULO)) {
      const operator = this.previous();
      const right = this.unary();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.unary();
      return new Unary(operator, right);
    }

    return this.call();
  }

  private call(): Expr {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: Expr): Expr {
    const args: Expr[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        if (args.length >= 255) {
          throw this.error(this.peek(), "函数参数不能超过 255 个");
        }
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }

    const paren = this.consume(TokenType.RIGHT_PAREN, "函数调用需要 ')'");

    return new Call(callee, paren, args);
  }

  private primary(): Expr {
    if (this.match(TokenType.FALSE)) return new Literal(false);
    if (this.match(TokenType.TRUE)) return new Literal(true);
    if (this.match(TokenType.NULL)) return new Literal(null);

    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return new Literal(this.previous().literal);
    }

    if (this.match(TokenType.LEFT_BRACKET)) {
      const elements: Expr[] = [];
      if (!this.check(TokenType.RIGHT_BRACKET)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RIGHT_BRACKET, "数组需要 ']'");
      return new Array(elements);
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return new Variable(this.previous());
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RIGHT_PAREN, "表达式后需要 ')'");
      return new Grouping(expr);
    }

    throw this.error(this.peek(), "需要表达式");
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): Error {
    const where = token.type === TokenType.EOF ? "文件末尾" : `'${token.lexeme}'`;
    return new Error(
      `第 ${token.line} 行，第 ${token.column} 列，在 ${where} 处：${message}`
    );
  }

  private synchronize() {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.RIGHT_BRACE) return;

      switch (this.peek().type) {
        case TokenType.FUNCTION:
        case TokenType.LET:
        case TokenType.IF:
        case TokenType.FOR:
        case TokenType.RETURN:
          return;
      }

      this.advance();
    }
  }
}
