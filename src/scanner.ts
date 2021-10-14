export class SourceRef {
	file: string;
	source: string;
	position: number;
	length: number;

	constructor(file: string, source: string, position: number, length: number) {
		this.file = file;
		this.source = source;
		this.position = position;
		this.length = length;
	}

	image(): string {
		return this.source.substr(this.position, this.length);
	}

	upto(): string {
		return this.source.substr(0, this.position + this.length);
	}

	remaining(): string {
		return this.source.substr(this.position + this.length);
	}

	lineNum(): number {
		return this.upto().split("\n").length;
	}

	colNum(): number {
		const lines = this.upto().split("\n");
		return (lines[lines.length - 1] ?? "").length;
	}

	printInContext(linesOfContext: number = 3): string {
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

	toString(): string {
		return `${this.file}:${this.lineNum()}:${this.colNum()}`;
	}
}

export class Scanner {
	source: string;
	file: string;
	position: number;

	constructor(source: string, file: string) {
		this.source = source;
		this.file = file;
		this.position = 0;
	}

	isDone(): boolean {
		return this.position >= this.source.length;
	}

	here() {
		return new SourceRef(this.file, this.source, this.position, 1);
	}

	scanString(string: string): SourceRef | undefined {
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

	scanRegexp(regexp: RegExp): SourceRef | undefined {
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
