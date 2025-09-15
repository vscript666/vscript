// 标记类型枚举
export enum TokenType {
  // 关键字
  FUNCTION = '函数',
  IF = '如果',
  ELSE = '否则',
  RETURN = '返回',
  FOR = '对于',
  IN = '在',
  LET = '就是',
  TRUE = '真',
  FALSE = '假',
  NULL = '空',
  
  // 标识符和字面量
  IDENTIFIER = 'IDENTIFIER',   // 变量名、函数名
  NUMBER = 'NUMBER',           // 数字
  STRING = 'STRING',           // 字符串
  
  // 运算符
  PLUS = '+',
  MINUS = '-',
  MULTIPLY = '*',
  DIVIDE = '/',
  MODULO = '%',
  ASSIGN = '=',
  
  // 比较运算符
  EQUAL = '==',
  NOT_EQUAL = '!=',
  LESS = '<',
  LESS_EQUAL = '<=',
  GREATER = '>',
  GREATER_EQUAL = '>=',
  
  // 逻辑运算符
  AND = '并',
  OR = '或',
  NOT = '非',
  
  // 分隔符
  LEFT_PAREN = '(',
  RIGHT_PAREN = ')',
  LEFT_BRACE = '{',
  RIGHT_BRACE = '}',
  LEFT_BRACKET = '[',
  RIGHT_BRACKET = ']',
  COMMA = ',',
  
  // 其他
  EOF = 'EOF'
}

// 标记类
export class Token {
  constructor(
    public type: TokenType,
    public lexeme: string,
    public literal: any,
    public line: number,
    public column: number
  ) {}

  toString(): string {
    return `${this.type} ${this.lexeme} ${this.literal}`;
  }
}

// 词法分析器类
export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;

  // 关键字映射
  private keywords: Map<string, TokenType> = new Map([
    ['函数', TokenType.FUNCTION],
    ['如果', TokenType.IF],
    ['否则', TokenType.ELSE],
    ['返回', TokenType.RETURN],
    ['对于', TokenType.FOR],
    ['在', TokenType.IN],
    ['就是', TokenType.LET],
    ['真', TokenType.TRUE],
    ['假', TokenType.FALSE],
    ['空', TokenType.NULL]
  ]);

  constructor(source: string) {
    this.source = source;
  }

  scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    this.tokens.push(new Token(TokenType.EOF, "", null, this.line, this.column));
    return this.tokens;
  }

  private scanToken() {
    const c = this.advance();
    switch (c) {
      // 单字符标记
      case '(': this.addToken(TokenType.LEFT_PAREN); break;
      case ')': this.addToken(TokenType.RIGHT_PAREN); break;
      case '{': this.addToken(TokenType.LEFT_BRACE); break;
      case '}': this.addToken(TokenType.RIGHT_BRACE); break;
      case '[': this.addToken(TokenType.LEFT_BRACKET); break;
      case ']': this.addToken(TokenType.RIGHT_BRACKET); break;
      case ',': this.addToken(TokenType.COMMA); break;
      case '+': this.addToken(TokenType.PLUS); break;
      case '-': this.addToken(TokenType.MINUS); break;
      case '*': this.addToken(TokenType.MULTIPLY); break;
      case '%': this.addToken(TokenType.MODULO); break;

      // 可能是双字符的运算符
      case '=':
        this.addToken(this.match('=') ? TokenType.EQUAL : TokenType.ASSIGN);
        break;
      case '!':
        this.addToken(this.match('=') ? TokenType.NOT_EQUAL : TokenType.NOT);
        break;
      case '<':
        this.addToken(this.match('=') ? TokenType.LESS_EQUAL : TokenType.LESS);
        break;
      case '>':
        this.addToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER);
        break;

      // 忽略空白字符
      case ' ':
      case '\r':
      case '\t':
        break;
      case '\n':
        this.line++;
        this.column = 1;
        break;

      // 字符串
      case '"': this.string(); break;

      // 注释
      case '/':
        if (this.match('/')) {
          // 单行注释
          while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
        } else if (this.match('*')) {
          // 多行注释
          this.multilineComment();
        } else {
          this.addToken(TokenType.DIVIDE);
        }
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw new Error(`意外的字符 '${c}' 在第 ${this.line} 行，第 ${this.column} 列`);
        }
    }
  }

  private multilineComment() {
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance(); // 消费 *
        this.advance(); // 消费 /
        return;
      }
      if (this.peek() === '\n') this.line++;
      this.advance();
    }
    throw new Error(`未闭合的多行注释在第 ${this.line} 行`);
  }

  private string() {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error(`未闭合的字符串在第 ${this.line} 行`);
    }

    // 消费结束的引号
    this.advance();

    // 获取字符串的值（去掉引号）
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken(TokenType.STRING, value);
  }

  private number() {
    while (this.isDigit(this.peek())) this.advance();

    // 处理小数
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // 消费小数点

      while (this.isDigit(this.peek())) this.advance();
    }

    const value = parseFloat(this.source.substring(this.start, this.current));
    this.addToken(TokenType.NUMBER, value);
  }

  private identifier() {
    while (this.isAlphaNumeric(this.peek())) this.advance();

    const text = this.source.substring(this.start, this.current);
    const type = this.keywords.get(text) || TokenType.IDENTIFIER;
    this.addToken(type);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;

    this.current++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }

  private isAlpha(c: string): boolean {
    return /[\u4e00-\u9fa5_a-zA-Z]/.test(c); // 支持中文字符
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    this.column++;
    return this.source.charAt(this.current++);
  }

  private addToken(type: TokenType, literal: any = null) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(new Token(type, text, literal, this.line, this.column - text.length));
  }
}
