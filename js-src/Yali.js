import { IncompleteForm, read } from "./reader.js";
import { AnsiCodes, applyCode } from "./AnsiCodes.js";
import { input, readFile } from "./Builtins.js";
import { ColorTransforms, print } from "./Printer.js";
import { Interpreter } from "./Interpreter.js";
import { createDefaultEnv } from "./DefaultEnv.js";

const PreludeFile = "./yali-src/prelude.yali";
const StartPrompt = applyCode(AnsiCodes.FgMagenta, "> ");
const ContinuePrompt = "..  ";
const MaxSequentialErrors = 100;

/**
 * @param {Interpreter} interpreter
 */
export async function loadPrelude(interpreter) {
	const source = readFile(interpreter, PreludeFile);
	const forms = read(source, PreludeFile);
	for (const form of forms) {
		await interpreter.interp(form);
	}
}

async function main() {
	const interpreter = new Interpreter(createDefaultEnv());
	await loadPrelude(interpreter);
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
			source += await input(interpreter, prompt);
			let forms = read(source, "repl");
			let result;
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
			if (typeof error.yaliStack !== "undefined") {
				console.error(
					applyCode(AnsiCodes.FgRed, `${error.name} ${error.message}`)
				);
				if (error.yaliStack.length > 0) {
					console.error(
						error.yaliStack
							.map((caller) => applyCode(AnsiCodes.Dim, `  at ${caller}`))
							.join("\n")
					);
				}
			} else {
				console.error(error);
			}
			sequentialErrors += 1;
		}
		source = "";
	}
}

main();
