import assert from "assert";
import { print } from "../src/Printer.js";
import { read } from "../src/Reader.js";
import { test } from "./Test.js";

async function testPrint(name, source, expected) {
	await test(name, () => {
		let forms = read(source, name);
		let actual = print(forms);
		assert.equal(actual, expected);
	});
}

testPrint("Nil literal", "nil", "(nil)");
testPrint("Bool literal", "true false", "(true false)");
testPrint("Num literal", "1 -3.4 +1e4", "(1 -3.4 10000)");
testPrint("Sym literal", "a b c", "(a b c)");
testPrint("Keyword literal", ":x :y", "(:x :y)");
testPrint("Str literal", '"hello\n, world"', '("hello\\n, world")');
testPrint("List literal", "(1 2 3)", "((1 2 3))");
testPrint("List constructor", "[1 2 3]", "((List 1 2 3))");
testPrint("Quote macro", "'a", "((quote a))");
