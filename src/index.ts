#!/usr/bin/env node
import { VScript } from './runtime';

async function main() {
  const vscript = new VScript();
  const args = process.argv.slice(2);

  if (args.length > 1) {
    console.log('用法: vscript [脚本文件]');
    process.exit(64);
  } else if (args.length === 1) {
    vscript.runFile(args[0]);
  } else {
    await vscript.runPrompt();
  }
}

main().catch(error => {
  console.error('\x1b[31m%s\x1b[0m', '致命错误：');
  console.error('\x1b[31m%s\x1b[0m', error.message);
  process.exit(1);
});
