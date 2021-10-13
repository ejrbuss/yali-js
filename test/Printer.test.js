import assert from "assert";
import { AnsiCodes, applyCode } from "../src/AnsiCodes.js";
import { print } from "../src/Printer.js";
import { read } from "../src/Reader.js";

async function test(name, source, expected) {
	try {
		let forms = read(source, name);
		let actual = print(forms);
		assert.equal(actual, expected);
		console.log(applyCode(AnsiCodes.FgGreen, ` ✔ ${name}`));
	} catch (error) {
		console.log();
		console.log(applyCode(AnsiCodes.FgRed, ` ✘ ${name}`));
		console.error(error);
	}
}

await test("Nil literal", "nil", "(nil)");
await test("Bool literal", "true false", "(true false)");
await test("Num literal", "1 -3.4 +1e4", "(1 -3.4 10000)");
await test("Sym literal", "a b c", "(a b c)");
await test("Keyword literal", ":x :y", "(:x :y)");
await test("Str literal", '"hello\n, world"', '("hello\\n, world")');
await test("List literal", "(1 2 3)", "((1 2 3))");
await test("List constructor", "[1 2 3]", "((List 1 2 3))");
await test("Quote macro", "'a", "((quote a))");
