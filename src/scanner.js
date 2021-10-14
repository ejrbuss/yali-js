export class SourceRef {
	constructor(file, source, position, length) {
		this.file = file;
		this.source = source;
		this.position = position;
		this.length = length;
	}

	image() {
		return this.source.substr(this.position, this.length);
	}

	upto() {
		return this.source.substr(0, this.position + this.length);
	}

	remaining() {
		return this.source.substr(this.position + this.length);
	}

	lineNum() {
		return this.upto().split("\n").length;
	}

	colNum() {
		const lines = this.upto().split("\n");
		return (lines[lines.length - 1] ?? "").length;
	}

	printInContext(linesOfContext = 3) {
		const lineNum = this.lineNum();
		const colNum = this.colNum();
		const start = Math.max(lineNum - 1 - linesOfContext, 0);
		const end = lineNum;
		const lines = this.source
			.split("\n")
			.slice(start, end)
			.map((line, i) => {
				let lineNum = `${i + start + 1}`;
				let formattedLineNum = " ".repeat(5 - lineNum.length) + lineNum;
				return `${formattedLineNum} | ${line}`;
			});
		const underline = " ".repeat(7 + colNum) + "^".repeat(this.length);
		return `${this.toString()}\n${lines.join("\n")}\n${underline}`;
	}

	toString() {
		return `${this.file}:${this.lineNum()}:${this.colNum()}`;
	}
}

export class Scanner {
	constructor(source, file) {
		this.source = source;
		this.file = file;
		this.position = 0;
	}

	isDone() {
		return this.position >= this.source.length;
	}

	here() {
		return new SourceRef(this.file, this.source, this.position, 1);
	}

	scanString(string) {
		if (this.source.startsWith(string, this.position)) {
			const length = string.length;
			const sourceRef = new SourceRef(
				this.file,
				this.source,
				this.position,
				length
			);
			this.position += length;
			return sourceRef;
		}
	}

	scanRegexp(regexp) {
		let match = regexp.exec(this.remaining());
		if (match && match.index === 0) {
			const length = match[0].length;
			const sourceRef = new SourceRef(
				this.file,
				this.source,
				this.position,
				length
			);
			this.position += length;
			return sourceRef;
		}
	}

	remaining() {
		return this.source.substr(this.position);
	}
}
