import {
  Expr,
  Binary,
  Grouping,
  Literal,
  Unary,
  Variable,
  Assign,
  Call,
  Array as ArrayExpr,
  ExprVisitor,
  Stmt,
  Expression,
  Function,
  If,
  Let,
  Return,
  While,
  Block,
  For,
  StmtVisitor
} from './parser';
import { Token, TokenType } from './lexer';

// 运行时错误类
class RuntimeError extends Error {
  constructor(
    public token: Token,
    message: string
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

// 返回语句的特殊处理
class ReturnValue {
  constructor(public value: any) {}
}

// 环境类（作用域）
class Environment {
  private values = new Map<string, any>();

  constructor(public readonly enclosing: Environment | null = null) {}

  define(name: string, value: any): void {
    this.values.set(name, value);
  }

  assign(name: Token, value: any): void {
    if (this.values.has(name.lexeme)) {
      this.values.set(name.lexeme, value);
      return;
    }

    if (this.enclosing) {
      this.enclosing.assign(name, value);
      return;
    }

    throw new RuntimeError(name, `未定义的变量 '${name.lexeme}'`);
  }

  get(name: Token): any {
    if (this.values.has(name.lexeme)) {
      return this.values.get(name.lexeme);
    }

    if (this.enclosing) {
      return this.enclosing.get(name);
    }

    throw new RuntimeError(name, `未定义的变量 '${name.lexeme}'`);
  }
}

// 可调用接口
interface VSCallable {
  call(interpreter: Interpreter, args: any[]): any;
  arity(): number;
}

// 函数类
class VSFunction implements VSCallable {
  constructor(
    private declaration: Function,
    private closure: Environment
  ) {}

  call(interpreter: Interpreter, args: any[]): any {
    const environment = new Environment(this.closure);
    
    for (let i = 0; i < this.declaration.params.length; i++) {
      environment.define(
        this.declaration.params[i].lexeme,
        args[i]
      );
    }

    try {
      interpreter.executeBlock(this.declaration.body, environment);
    } catch (returnValue) {
      if (returnValue instanceof ReturnValue) {
        return returnValue.value;
      }
      throw returnValue;
    }

    return null;
  }

  arity(): number {
    return this.declaration.params.length;
  }

  toString(): string {
    return `<函数 ${this.declaration.name.lexeme}>`;
  }
}

// 解释器类
export class Interpreter implements ExprVisitor<any>, StmtVisitor<void> {
  readonly globals = new Environment();
  private environment = this.globals;

  constructor() {
    // 添加内置函数
    this.globals.define('输出', {
      call: (_interpreter: Interpreter, args: any[]) => {
        console.log(...args);
        return null;
      },
      arity: () => 1,
      toString: () => '<内置函数 输出>'
    });

    this.globals.define('范围', {
      call: (_interpreter: Interpreter, args: any[]) => {
        const start = args[0];
        const end = args[1];
        if (typeof start !== 'number' || typeof end !== 'number') {
          throw new Error('范围函数需要两个数字参数');
        }
        return Array.from({ length: end - start }, (_, i) => start + i);
      },
      arity: () => 2,
      toString: () => '<内置函数 范围>'
    });

    this.globals.define('长度', {
      call: (_interpreter: Interpreter, args: any[]) => {
        const arg = args[0];
        if (Array.isArray(arg)) {
          return arg.length;
        }
        if (typeof arg === 'string') {
          return arg.length;
        }
        throw new Error('长度函数需要数组或字符串参数');
      },
      arity: () => 1,
      toString: () => '<内置函数 长度>'
    });

    this.globals.define('类型', {
      call: (_interpreter: Interpreter, args: any[]) => {
        const arg = args[0];
        if (Array.isArray(arg)) return '数组';
        if (typeof arg === 'number') return '数字';
        if (typeof arg === 'string') return '字符串';
        if (typeof arg === 'boolean') return '布尔';
        if (arg === null) return '空';
        if (arg instanceof VSFunction) return '函数';
        return '未知';
      },
      arity: () => 1,
      toString: () => '<内置函数 类型>'
    });
  }

  interpret(statements: Stmt[]): void {
    try {
      for (const statement of statements) {
        this.execute(statement);
      }
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw new Error(
          `运行时错误（第 ${error.token.line} 行，第 ${error.token.column} 列）：${error.message}`
        );
      }
      throw error;
    }
  }

  private execute(stmt: Stmt): void {
    stmt.accept(this);
  }

  executeBlock(statements: Stmt[], environment: Environment): void {
    const previous = this.environment;
    try {
      this.environment = environment;
      for (const statement of statements) {
        this.execute(statement);
      }
    } finally {
      this.environment = previous;
    }
  }

  private evaluate(expr: Expr): any {
    return expr.accept(this);
  }

  private isTruthy(object: any): boolean {
    if (object === null) return false;
    if (typeof object === 'boolean') return object;
    return true;
  }

  private isEqual(a: any, b: any): boolean {
    if (a === null && b === null) return true;
    if (a === null) return false;
    return a === b;
  }

  private checkNumberOperand(operator: Token, operand: any): void {
    if (typeof operand === 'number') return;
    throw new RuntimeError(operator, '操作数必须是数字');
  }

  private checkNumberOperands(operator: Token, left: any, right: any): void {
    if (typeof left === 'number' && typeof right === 'number') return;
    throw new RuntimeError(operator, '操作数必须是数字');
  }

  // 访问者模式实现 - 表达式
  visitBinaryExpr(expr: Binary): any {
    const left = this.evaluate(expr.left);
    const right = this.evaluate(expr.right);

    switch (expr.operator.type) {
      case TokenType.MINUS:
        this.checkNumberOperands(expr.operator, left, right);
        return left - right;
      case TokenType.PLUS:
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        if (typeof left === 'string' && typeof right === 'string') {
          return left + right;
        }
        throw new RuntimeError(expr.operator, '操作数必须都是数字或都是字符串');
      case TokenType.DIVIDE:
        this.checkNumberOperands(expr.operator, left, right);
        if (right === 0) {
          throw new RuntimeError(expr.operator, '除数不能为零');
        }
        return left / right;
      case TokenType.MULTIPLY:
        this.checkNumberOperands(expr.operator, left, right);
        return left * right;
      case TokenType.MODULO:
        this.checkNumberOperands(expr.operator, left, right);
        return left % right;
      case TokenType.GREATER:
        this.checkNumberOperands(expr.operator, left, right);
        return left > right;
      case TokenType.GREATER_EQUAL:
        this.checkNumberOperands(expr.operator, left, right);
        return left >= right;
      case TokenType.LESS:
        this.checkNumberOperands(expr.operator, left, right);
        return left < right;
      case TokenType.LESS_EQUAL:
        this.checkNumberOperands(expr.operator, left, right);
        return left <= right;
      case TokenType.EQUAL:
        return this.isEqual(left, right);
      case TokenType.NOT_EQUAL:
        return !this.isEqual(left, right);
      case TokenType.AND:
        return this.isTruthy(left) && this.isTruthy(right);
      case TokenType.OR:
        return this.isTruthy(left) || this.isTruthy(right);
    }

    return null;
  }

  visitGroupingExpr(expr: Grouping): any {
    return this.evaluate(expr.expression);
  }

  visitLiteralExpr(expr: Literal): any {
    return expr.value;
  }

  visitUnaryExpr(expr: Unary): any {
    const right = this.evaluate(expr.right);

    switch (expr.operator.type) {
      case TokenType.MINUS:
        this.checkNumberOperand(expr.operator, right);
        return -right;
      case TokenType.NOT:
        return !this.isTruthy(right);
    }

    return null;
  }

  visitVariableExpr(expr: Variable): any {
    return this.environment.get(expr.name);
  }

  visitAssignExpr(expr: Assign): any {
    const value = this.evaluate(expr.value);
    this.environment.assign(expr.name, value);
    return value;
  }

  visitCallExpr(expr: Call): any {
    const callee = this.evaluate(expr.callee);

    const args = expr.args.map(arg => this.evaluate(arg));

    if (!(callee as VSCallable).call) {
      throw new RuntimeError(expr.paren, '只能调用函数');
    }

    const func = callee as VSCallable;
    if (args.length !== func.arity()) {
      throw new RuntimeError(
        expr.paren,
        `期望 ${func.arity()} 个参数但得到 ${args.length} 个`
      );
    }

    return func.call(this, args);
  }

  visitArrayExpr(expr: ArrayExpr): any {
    return expr.elements.map(element => this.evaluate(element));
  }

  // 访问者模式实现 - 语句
  visitExpressionStmt(stmt: Expression): void {
    this.evaluate(stmt.expression);
  }

  visitFunctionStmt(stmt: Function): void {
    const func = new VSFunction(stmt, this.environment);
    this.environment.define(stmt.name.lexeme, func);
  }

  visitIfStmt(stmt: If): void {
    if (this.isTruthy(this.evaluate(stmt.condition))) {
      this.execute(stmt.thenBranch);
    } else if (stmt.elseBranch) {
      this.execute(stmt.elseBranch);
    }
  }

  visitLetStmt(stmt: Let): void {
    let value = null;
    if (stmt.initializer) {
      value = this.evaluate(stmt.initializer);
    }

    this.environment.define(stmt.name.lexeme, value);
  }

  visitReturnStmt(stmt: Return): void {
    let value = null;
    if (stmt.value) {
      value = this.evaluate(stmt.value);
    }

    throw new ReturnValue(value);
  }

  visitWhileStmt(stmt: While): void {
    while (this.isTruthy(this.evaluate(stmt.condition))) {
      this.execute(stmt.body);
    }
  }

  visitBlockStmt(stmt: Block): void {
    this.executeBlock(stmt.statements, new Environment(this.environment));
  }

  visitForStmt(stmt: For): void {
    const iterable = this.evaluate(stmt.iterable);
    
    if (!Array.isArray(iterable)) {
      throw new RuntimeError(stmt.variable, "'对于' 循环需要一个数组");
    }

    const environment = new Environment(this.environment);
    for (const value of iterable) {
      environment.define(stmt.variable.lexeme, value);
      this.executeBlock([stmt.body], environment);
    }
  }
}
