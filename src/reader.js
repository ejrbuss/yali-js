import { List as IList } from "immutable";
import { Keyword } from "./keyword.js";
import { Scanner } from "./scanner.js";
import { ConstructorSymbols, Special, SpecialForms } from "./symbols.js";

export class IncompleteForm extends SyntaxError {}

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
			return readForms("]").unshift(ConstructorSymbols.List);
		}
		if (scanner.scanString("{")) {
			return readForms("}").unshift(ConstructorSymbols.Map);
		}
		if (scanner.scanString("'")) {
			return IList.of(SpecialForms.Quote, readForm());
		}
		if (scanner.scanString("`")) {
			return IList.of(SpecialForms.QuasiQuote, readForm());
		}
		if (scanner.scanString(",,,")) {
			return IList.of(SpecialForms.UnquoteSplice, readForm());
		}
		if (scanner.scanString(",")) {
			return IList.of(SpecialForms.Unquote, readForm());
		}
		let match;
		if ((match = scanner.scanRegexp(ReString))) {
			// JSON.parse does not handle multi-line string
			// so we need to escape them
			return JSON.parse(match.image().replace("\n", "\\n"));
		}
		if ((match = scanner.scanRegexp(ReSymbol))) {
			const image = match.image();
			if (image === "nil") {
				return undefined;
			}
			if (image === "true") {
				return true;
			}
			if (image === "false") {
				return false;
			}
			if (image.startsWith(":")) {
				return Keyword.for(image.substr(1));
			}
			if (ReNumber.test(image)) {
				return parseFloat(image);
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
