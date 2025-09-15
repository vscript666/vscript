import * as fs from 'fs';
import * as readline from 'readline';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';

export class VScript {
  private interpreter = new Interpreter();

  constructor() {}

  // 运行源代码
  run(source: string): void {
    try {
      const lexer = new Lexer(source);
      const tokens = lexer.scanTokens();
      
      const parser = new Parser(tokens);
      const statements = parser.parse();
      
      this.interpreter.interpret(statements);
    } catch (error) {
      if (error instanceof Error) {
        console.error('\x1b[31m%s\x1b[0m', error.message); // 红色错误信息
      } else {
        console.error('\x1b[31m%s\x1b[0m', '发生未知错误');
      }
    }
  }

  // 运行文件
  runFile(path: string): void {
    try {
      const source = fs.readFileSync(path, 'utf8');
      this.run(source);
    } catch (error) {
      if (error instanceof Error) {
        console.error('\x1b[31m%s\x1b[0m', `错误：无法读取文件 '${path}'`);
        console.error('\x1b[31m%s\x1b[0m', error.message);
      }
      process.exit(70);
    }
  }

  // 运行 REPL
  async runPrompt(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\x1b[36m%s\x1b[0m', 'VScript 交互式环境 v0.1.0');
    console.log('\x1b[36m%s\x1b[0m', '输入 ".退出" 退出程序\n');

    while (true) {
      const line = await new Promise<string>(resolve => {
        rl.question('> ', resolve);
      });

      if (line === '.退出') break;
      
      try {
        this.run(line);
      } catch (error) {
        // 错误已在 run 方法中处理
      }
    }

    rl.close();
  }
}