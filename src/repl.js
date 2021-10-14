import repl from "repl";
import { applyCode, Dim, FgMagenta } from "./ansi.js";
import { DefaultColors, print } from "./printer.js";
import { IncompleteForm } from "./reader.js";
import { getInterpreter, seval } from "./builtins.js";
import { extendEnv } from "./env.js";
import { Special } from "./symbols.js";
import { isList } from "immutable";

const interpreter = getInterpreter();
const replEnv = extendEnv(interpreter.globalEnv);

function evalInput(input, _ctx, file, callback) {
	try {
		callback(null, seval(input, replEnv, file));
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

repl.start({
	prompt: "> ",
	eval: evalInput,
	writer: writeOutput,
});
