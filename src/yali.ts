import { createInterface } from "readline";
import { applyCode, FgMagenta } from "./ansi.js";
import { DefaultColors, print } from "./printer.js";
import { IncompleteForm, read } from "./reader.js";

const Prompt = applyCode(FgMagenta, "> ");
const ContinuePrompt = "..  ";
const MaxSequentialErrors = 100;

export async function repl() {
	const readline = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	async function prompt(): Promise<String> {
		return new Promise((resolve) =>
			readline.question(input.length ? ContinuePrompt : Prompt, resolve)
		);
	}
	let input = "";
	let sequentialErrors = 0;
	while (sequentialErrors < MaxSequentialErrors) {
		try {
			input += await prompt();
			const forms = read(input, "<repl>");
			console.log(print(forms, DefaultColors));
			sequentialErrors = 0;
			input = "";
		} catch (error) {
			if (error instanceof IncompleteForm) {
				input += "\n  ";
				continue;
			}
		}
	}
	readline.close();
}

repl();
