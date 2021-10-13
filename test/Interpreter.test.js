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

await test("Empty program", "", "nil");
await test("Nil literal", "nil", "nil");
await test("True literal", "true", "true");
await test("False literal", "false", "false");
await test("Num literal", "14.5", "14.5");
await test("Keyword literal", ":x", ":x");
await test("Str literal", '"test\n"', '"test\n"');
await test("List constructor", "[1 2 3]", "(1 2 3)");
await test("One plus one", "(__builtin__add 1 1)", "2");
await test("Add spread list", "(__builtin__add ... [3 4])", "7");
await test("Add spread map", '(__builtin__add "x" ... { 1 2 })', '"x1,2"');
await test("Basic Str conversion", '(Str nil "x" :x 3)', '"x:x3"');
await test("Def variable", "(def x 4) x", "4");
await test("Def chain", "(def x 42) (def y x) y", "42");
await test("If no args", "(if)", "nil");
await test("If true", "(if true 1 2)", "1");
await test("If false", "(if false 1 2)", "2");
await test("If nil", "(if nil 4)", "nil");
// await test("Def proc name", "(def p (proc (x) x)) (Str p)", '"#proc<p>"');
