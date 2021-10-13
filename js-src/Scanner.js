export class Scanner {
	/** @type {string} */ source;
	/** @type {string} */ file;
	/** @type {number} */ position;

	/**
	 * @param {string} source
	 */
	constructor(source, file) {
		this.source = source;
		this.file = file;
		this.position = 0;
	}

	/**
	 * @returns {boolean}
	 */
	isDone() {
		return this.position >= this.source.length;
	}

	/**
	 * @returns {[number, number]}
	 */
	getLineAndColumn() {
		let upto = this.source.slice(0, this.position + 1);
		let lines = upto.split("\n");
		let lineNum = lines.length;
		let colNum = lines[lines.length - 1].length;
		return [lineNum, colNum];
	}

	highlight(context = 3) {
		let [lineNum, colNum] = this.getLineAndColumn();
		let lines = this.source.split("\n");
		let startLineNum = Math.max(lineNum - 1 - context, 0);
		let endLineNum = lineNum;
		let relevantLines = lines.slice(startLineNum, endLineNum);
		let formattedLines = relevantLines.map((line, i) => {
			let lineNum = i + startLineNum + 1;
			let formattedLineNum = " ".repeat(5 - `${lineNum}`.length) + lineNum;
			return `${formattedLineNum} | ${line}`;
		});
		let highlight = " ".repeat(7 + colNum) + "^";
		return `${formattedLines.join("\n")}\n${highlight}`;
	}

	/**
	 * @param {string} string
	 * @returns {string | undefined}
	 */
	scanString(string) {
		if (this.source.startsWith(string, this.position)) {
			this.position += string.length;
			return string;
		}
	}

	/**
	 * @param {RegExp} regexp
	 * @returns {string | undefined}
	 */
	scanRegexp(regexp) {
		let match = regexp.exec(this.#getRemaining());
		if (match && match.index === 0) {
			let string = match[0];
			this.position += string.length;
			return string;
		}
	}

	#getRemaining() {
		return this.source.slice(this.position);
	}
}
