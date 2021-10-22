import repl from "repl";
import { fileURLToPath } from "url";
import { colorPrint, print } from "./printer.js";
import { IncompleteForm, read } from "./reader.js";
import { getInterpreter, evalForm } from "./builtins.js";
import { Special, SpecialForms } from "./symbols.js";

export function completerFor(interpreter) {
	return function (line) {
		// do not try and complete strings
		if (line.includes('"')) {
			return [[], line];
		}
		const tokens = line.split(/[\(\)\[\]\{\}\s]+/);
		const finalToken = tokens[tokens.length - 1];
		// do not try and complete keywords
		if (finalToken[0] === ":") {
			return [[], line];
		}
		const env = interpreter.currentEnv;
		const [targetName, ...path] = finalToken.split(".");
		if (path.length === 0) {
			const beforeFinalToken = line.substr(0, line.length - finalToken.length);
			const hits = [];
			Object.values(SpecialForms).forEach((symbol) => {
				if (symbol.description.startsWith(targetName)) {
					hits.push(beforeFinalToken + symbol.description);
				}
			});
			Object.getOwnPropertySymbols(env).forEach((symbol) => {
				if (symbol.description.startsWith(targetName)) {
					hits.push(beforeFinalToken + symbol.description);
				}
			});
			return [hits, line];
		}
		const finalPart = path.pop();
		const beforeFinalPart = line.substr(0, line.length - finalPart.length);
		let target = env[Symbol.for(targetName)];
		if (!target) {
			return [[], line];
		}
		for (const part of path) {
			target = target[part];
			if (!target) {
				return [[], line];
			}
		}
		const hits = [];
		Object.getOwnPropertyNames(target).forEach((name) => {
			if (name.startsWith(finalPart)) {
				hits.push(beforeFinalPart + name);
			}
		});
		return [hits, line];
	};
}

export function replFor(interpreter, options = { color: true, preview: true }) {
	const replEnv = interpreter.globalEnv.extendEnv("repl");

	// adapt sourceEval to node repl
	function replEval(input, _ctx, file, callback) {
		try {
			const forms = read(input, file);
			let result;
			forms.forEach((form) => {
				result = evalForm(form, replEnv);
			});
			callback(null, result);
		} catch (error) {
			if (error instanceof IncompleteForm) {
				callback(new repl.Recoverable(error));
			} else {
				callback(error);
			}
		}
	}

	function replWriter(output) {
		if (output && output instanceof Error) {
			return (output[Special.stack] ?? "") + "\n" + output.stack;
		}
		return options.color ? colorPrint(output) : print(output);
	}

	repl.start({
		eval: replEval,
		writer: replWriter,
		completer: completerFor(interpreter),
		preview: options.preview,
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	replFor(getInterpreter());
}
