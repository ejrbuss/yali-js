import { createInterface } from "readline";
import { applyCode, FgMagenta } from "./ansi.js";
import { DefaultColors, print } from "./printer.js";
import { IncompleteForm } from "./reader.js";
import { fileURLToPath } from "url";
import { createBuiltinsEnv, seval } from "./builtins.js";

const Prompt = applyCode(FgMagenta, "> ");
const ContinuePrompt = "..  ";
const MaxSequentialErrors = 100;

export async function repl() {
	const readline = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	async function prompt() {
		return new Promise((resolve) =>
			readline.question(input.length ? ContinuePrompt : Prompt, resolve)
		);
	}

	let input = "";
	let sequentialErrors = 0;
	let replEnv = createBuiltinsEnv();
	while (sequentialErrors < MaxSequentialErrors) {
		try {
			input += await prompt();
			const result = seval(input, replEnv, "<repl>");
			console.log(print(result, DefaultColors));
			sequentialErrors = 0;
			input = "";
		} catch (error) {
			if (error instanceof IncompleteForm) {
				input += "\n  ";
				continue;
			}
			console.error(error);
			input = "";
		}
	}
	readline.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	repl();
}
