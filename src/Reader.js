import { List } from "immutable";
import { Constructors, SpecialForms } from "./Symbols.js";
import { Scanner } from "./Scanner.js";
import { Keyword } from "./keyword.js";

export class IncompleteForm extends Error {}

const ReWhitepsace = /^(\s|(;[^\n]*))+/;
const ReString = /^"((\\.)|[^"])*"/;
const ReSymbol = /^[^\s#;\(\)\[\]\{\}"]+/;
const ReNumber = /^[+-]?(\d+|\.\d+|\d+\.\d+|\d+\.)(e[+-]?\d+)?$/;

export function read(source, file = "<anonymous>") {
	const scanner = new Scanner(source, file);

	function readForm() {
		scanner.scanRegexp(ReWhitepsace);
		if (scanner.scanString("(")) {
			return readForms(")");
		}
		if (scanner.scanString("[")) {
			return readForms("]").unshift(Constructors.List);
		}
		if (scanner.scanString("{")) {
			return readForms("}").unshift(Constructors.Map);
		}
		if (scanner.scanString("'")) {
			return List.of(SpecialForms.Quote, readForm());
		}
		if (scanner.scanString("`")) {
			return List.of(SpecialForms.QuasiQuote, readForm());
		}
		if (scanner.scanString(",,,")) {
			return List.of(SpecialForms.UnquoteSplice, readForm());
		}
		if (scanner.scanString(",")) {
			return List.of(SpecialForms.Unquote, readForm());
		}
		let match;
		if ((match = scanner.scanRegexp(ReString))) {
			// JSON.parse does not handle multi-line string
			// so we need to escape them
			return JSON.parse(match.replace(/\n/g, "\\n"));
		}
		if ((match = scanner.scanRegexp(ReSymbol))) {
			if (match === "nil") {
				return undefined;
			}
			if (match === "true") {
				return true;
			}
			if (match === "false") {
				return false;
			}
			if (match.startsWith(":")) {
				return Keyword.for(match.substr(1));
			}
			if (ReNumber.test(match)) {
				return parseFloat(match);
			}
			return Symbol.for(match);
		}
		throw new SyntaxError(readerErrorMessage("Unexpected character"));
	}

	function readForms(terminator) {
		let forms = [];
		for (;;) {
			scanner.scanRegexp(ReWhitepsace);
			if (scanner.isDone()) {
				throw new IncompleteForm(readerErrorMessage("Unexpected end of input"));
			}
			if (scanner.scanString(terminator)) {
				return List(forms);
			}
			forms.push(readForm());
		}
	}

	function readerErrorMessage(message) {
		let [line, col] = scanner.getLineAndColumn();
		let highlight = scanner.highlight();
		return `${message} at ${scanner.file}:${line}:${col}\n${highlight}`;
	}

	let forms = [];
	for (;;) {
		scanner.scanRegexp(ReWhitepsace);
		if (scanner.isDone()) {
			break;
		}
		forms.push(readForm());
	}
	return List(forms);
}
