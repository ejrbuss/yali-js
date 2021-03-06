import { List as IList } from "immutable";
import { Keyword } from "./keyword.js";
import { Scanner } from "./scanner.js";
import { ConstructorSymbols, Special, SpecialForms } from "./symbols.js";

export class IncompleteForm extends SyntaxError {}

const ReWhitepsace = /^(\s|(;[^\n]*))+/;
const ReString = /^"((\\.)|[^"])*"/;
const ReSymbol = /^[^\s#;\(\)\[\]\{\}"]+/;
const ReBinInt = /^0b[01]+$/i;
const ReOctInt = /^0o[0-7]+$/i;
const ReHexInt = /^0x[\da-f]+$/i;
const ReNumber = /^[+-]?(\d+|\.\d+|\d+\.\d+|\d+\.)(e[+-]?\d+)?$/;

export function read(source, file = "<anonymous>") {
	const scanner = new Scanner(source, file);

	function readForm() {
		scanner.scanRegexp(ReWhitepsace);
		// List
		if (scanner.scanString("(")) {
			return readForms(")");
		}
		// List constructor
		if (scanner.scanString("[")) {
			return readForms("]").unshift(ConstructorSymbols.List);
		}
		// Map constructor
		if (scanner.scanString("{")) {
			return readForms("}").unshift(ConstructorSymbols.Map);
		}
		// Quote
		if (scanner.scanString("'")) {
			return IList.of(SpecialForms.Quote, readForm());
		}
		// Quasi-quote
		if (scanner.scanString("`")) {
			return IList.of(SpecialForms.QuasiQuote, readForm());
		}
		// Unquote splice
		if (scanner.scanString(",,,")) {
			return IList.of(SpecialForms.UnquoteSplice, readForm());
		}
		// Unquote
		if (scanner.scanString(",")) {
			return IList.of(SpecialForms.Unquote, readForm());
		}
		// Splice
		if (scanner.scanString("...")) {
			return IList.of(SpecialForms.Splice, readForm());
		}
		// Str
		let match;
		if ((match = scanner.scanRegexp(ReString))) {
			// JSON.parse does not handle multi-line string
			// so we need to escape them
			return JSON.parse(match.image().replace("\n", "\\n"));
		}
		if ((match = scanner.scanRegexp(ReSymbol))) {
			const image = match.image();
			// nil
			if (image === "nil") {
				return undefined;
			}
			// true
			if (image === "true") {
				return true;
			}
			// false
			if (image === "false") {
				return false;
			}
			// infinity
			if (image === "infinity") {
				return Infinity;
			}
			// -infinity
			if (image === "-infinity") {
				return -Infinity;
			}
			// keyword
			if (image.startsWith(":")) {
				return Keyword.for(image.substr(1));
			}
			// integers
			if (ReBinInt.test(image)) {
				return parseInt(image.substr(2), 0b10);
			}
			if (ReOctInt.test(image)) {
				return parseInt(image.substr(2), 0o10);
			}
			if (ReHexInt.test(image)) {
				return parseInt(image.substr(2), 0x10);
			}
			// floats
			if (ReNumber.test(image)) {
				return parseFloat(image);
			}
			// accessor
			if (
				image.includes(".") &&
				image !== "." &&
				image !== ".?" &&
				image !== ".@"
			) {
				const [target, ...keys] = image.split(".");
				return IList.of(SpecialForms.Dot, Symbol.for(target), ...keys);
			}
			return Symbol.for(image);
		}
		throw new SyntaxError(
			`Unexpected character at ${scanner.here().printInContext()}`
		);
	}

	function readForms(terminator) {
		const formsArray = [];
		const here = scanner.here();
		here.position -= 1;
		for (;;) {
			scanner.scanRegexp(ReWhitepsace);
			if (scanner.isDone()) {
				throw new IncompleteForm(
					`Unexpected end of input at ${scanner.here().printInContext()}`
				);
			}
			if (scanner.scanString(terminator)) {
				here.length = scanner.position - here.position;
				let forms = IList(formsArray);
				forms[Special.sourceRef] = here;
				return forms;
			}
			formsArray.push(readForm());
		}
	}

	let formsArray = [];
	for (;;) {
		scanner.scanRegexp(ReWhitepsace);
		if (scanner.isDone()) {
			break;
		}
		formsArray.push(readForm());
	}
	return IList(formsArray);
}
