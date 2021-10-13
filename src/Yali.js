import { IncompleteForm, read } from "./reader.js";
import { AnsiCodes, applyCode } from "./AnsiCodes.js";
import { input } from "./Builtins.js";
import { ColorTransforms, print } from "./Printer.js";
import { Interpreter } from "./Interpreter.js";
import { createDefaultEnv } from "./DefaultEnv.js";

const StartPrompt = applyCode(AnsiCodes.FgMagenta, "> ");
const ContinuePrompt = "..  ";
const MaxSequentialErrors = 100;

async function main() {
	const interpreter = new Interpreter(createDefaultEnv());
	let source = "";
	let sequentialErrors = 0;
	console.log(`Welcome to Yali.js v${process.env.npm_package_version}`);
	for (;;) {
		if (sequentialErrors > MaxSequentialErrors) {
			console.error("Exceeded max sequential errors!");
			process.exit(1);
		}
		try {
			let prompt = source.length === 0 ? StartPrompt : ContinuePrompt;
			source += await input(prompt);
			let forms = read(source, "repl");
			let result = undefined;
			for (let form of forms) {
				result = await interpreter.interp(form);
			}
			let echo = print(result, ColorTransforms);
			console.log(echo);
			sequentialErrors = 0;
		} catch (error) {
			if (error instanceof IncompleteForm) {
				source += "\n  ";
				continue;
			}
			sequentialErrors += 1;
			delete error.env;
			console.error(error);
		}
		source = "";
	}
}

main();
