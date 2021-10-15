import repl from "repl";
import { applyCode, Dim } from "./ansi.js";
import { DefaultColors, print } from "./printer.js";
import { IncompleteForm } from "./reader.js";
import { getInterpreter, sourceEval } from "./builtins.js";
import { Special } from "./symbols.js";

const interpreter = getInterpreter();
const replEnv = interpreter.globalEnv.extendEnv("repl");

function evalInput(input, _ctx, file, callback) {
	try {
		callback(null, sourceEval(input, replEnv, file));
	} catch (error) {
		if (error instanceof IncompleteForm) {
			callback(new repl.Recoverable(error));
		} else {
			callback(error);
		}
	}
}

function writeOutput(output) {
	if (output && (output instanceof Error || output[Special.stack])) {
		const name = output.name;
		const message = output.message;
		const header = `${name}: ${message}`;
		const jsStack = output.stack
			.split("\n")
			.filter((line) => /at.*file:/.test(line))
			.join("\n");
		let yaliStack = "";
		if (output[Special.stack] && output[Special.stack].length > 0) {
			yaliStack =
				output[Special.stack]
					.map((proc) => {
						const name = proc[Special.name] ?? proc.name ?? "anonymous";
						return `    at ${name}`;
					})
					.join("\n") + "\n";
		}
		return `${header}\n${yaliStack}${applyCode(Dim, jsStack)}`;
	}
	return print(output, DefaultColors);
}

const replServer = repl.start({
	eval: evalInput,
	writer: writeOutput,
	// completer: TODO
	// preview: true,
});
