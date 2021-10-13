import assert from "assert";
import { print } from "../src/Printer.js";
import { read } from "../src/Reader.js";
import { test } from "./Test.js";

async function testPrint(name, source, expected) {
	await test(name, () => {
		let forms = read(source, name);
		let actual = print(forms);
		assert.strictEqual(actual, expected);
	});
}

await testPrint("Nil literal", "nil", "(nil)");
await testPrint("Bool literal", "true false", "(true false)");
await testPrint("Num literal", "1 -3.4 +1e4", "(1 -3.4 10000)");
await testPrint("Sym literal", "a b c", "(a b c)");
await testPrint("Keyword literal", ":x :y", "(:x :y)");
await testPrint("Str literal", '"hello\n, world"', '("hello\\n, world")');
await testPrint("List literal", "(1 2 3)", "((1 2 3))");
await testPrint("List constructor", "[1 2 3]", "((List 1 2 3))");
await testPrint("Quote macro", "'a", "((quote a))");
