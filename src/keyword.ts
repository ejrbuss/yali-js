export class Keyword {
	static KeywordCache: { [name: string]: Keyword | undefined } = {};

	name: string;

	static for(name: string): Keyword {
		const cache = Keyword.KeywordCache;
		let keyword = cache[name];
		if (typeof keyword !== "undefined") {
			return keyword;
		}
		keyword = new Keyword(name);
		cache[name] = keyword;
		return keyword;
	}

	private constructor(name: string) {
		this.name = name;
	}
}
