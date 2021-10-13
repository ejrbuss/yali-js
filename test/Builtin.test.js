import assert from "assert";
import { isList, isMap } from "immutable";
import { AnsiCodes, applyCode } from "../src/AnsiCodes.js";
import { createDefaultEnv } from "../src/DefaultEnv.js";
import { Interpreter } from "../src/Interpreter.js";
import { read } from "../src/Reader.js";

async function test(name, source, expected) {
	try {
		let interpreter = new Interpreter(createDefaultEnv());
		let forms = read(source, name);
		let actual;
		for (let form of forms) {
			actual = await interpreter.interp(form);
		}
		if (isList(actual) || isMap(actual)) {
			actual = actual.toJS();
		}
		expected = read(expected).first();
		if (isList(expected) || isMap(expected)) {
			expected = expected.toJS();
		}
		assert.deepEqual(actual, expected);
		console.log(applyCode(AnsiCodes.FgGreen, ` ✔ ${name}`));
	} catch (error) {
		delete error.env;
		console.log();
		console.log(applyCode(AnsiCodes.FgRed, ` ✘ ${name}`));
		console.log();
		console.error(error);
		console.log();
	}
}
