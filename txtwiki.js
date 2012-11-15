"use strict";

var txtwiki = (function(){

	var times = [];
	
	function getTimes() {
		return times;
	}
	
	function resetTimes() {
		times = [];
	}
	
	function startTime() {
		return (new Date).getTime();
	}
	
	function endTime(func,start) {
		var diff = (new Date).getTime() - start;
		if (times[func] == undefined)
			times[func] = 0;
		times[func] += diff;
	}
	
	function audit(content) {
		if (content.indexOf("<ref") != -1 && content.search(/<\/ref>|\/>/) != -1) {
			console.log(content);
			throw new Error("found a ref");
		}
		if (content.indexOf("[[") != -1 && content.indexOf("]]") != -1) {
			console.log(content);
			throw new Error("found a link");
		}
		if (content.indexOf("<!--") != -1 && content.indexOf("-->") != -1) {
			console.log(content);
			throw new Error("found a comment");
		}
		if (content.indexOf("{|") != -1 && content.indexOf("|}") != -1) {
			console.log(content);
			throw new Error("found a table");
		}
	}
	
	function parseWikitext(content){
		var start = startTime();
		
		var parsed = "";

		content = stripWhitespace(content);

		content = firstPass(content);
		content = secondPass(content);

		var paragraphs = content.split("\n");
		for (var i = 0; i < paragraphs.length; i++){
			if (paragraphs[i].length === 0){
				parsed += "\n";
				continue;
			}

			paragraphs[i] = boldItalicPass(paragraphs[i]);

			parsed += paragraphs[i] + "\n";
		}

		parsed = stripWhitespace(parsed);
		
		//console.log(parsed);
		audit(parsed);
		
		endTime("parseWikitext",start);
		
		return parsed;
	}

	function parseSimpleTag(content, pos, start, end){
		var timerStart = startTime();
		
		if (content.slice(pos, pos + start.length) == start){
			pos += start.length;
			var posEnd = content.indexOf(end, pos);
			if (posEnd == -1) {
				posEnd = pos;
			}
			endTime("parseSimpleTag",timerStart);
			return {text: content.slice(pos, posEnd), pos: posEnd + end.length};
		}
		endTime("parseSimpleTag",timerStart);
		return {text: null, pos: pos};
	}

	function parseLink(content, pos){
		var start = startTime();
		if (content.slice(pos, pos + 2) == "[["){
			var link = "";
			pos += 2;
			var posOrig = pos;
			while ((pos+2) < content.length && content.slice(pos, pos + 2) != "]]"){
				if (content.slice(pos, pos + 2) == "[["){
					var out = parseLink(content, pos);
					link += out.text;
					if (out.pos > pos) {
						pos = out.pos;
					}
					else {
						pos++;
					}
				} else {
					link += content[pos];
					pos++;
				}
			}
			if ((pos+2) >= content.length && content.slice(pos, pos + 2) != "]]")
				return {text: "", pos: posOrig};
				
			pos += 2;

			var args = link.split("|");
			endTime("parseLink",start);
			if (args.length == 1)
				return {text: args[0], pos: pos};
			else {
				if (args[0].slice(0, 5) == "File:")
					return {text: "", pos: pos}
				return {text: args[1], pos: pos};
			}
		}
		endTime("parseLink",start);
		return {text: null, pos: pos};
	}

	function parseRef(content, pos){
		var start = startTime();
		if (content.slice(pos, pos + 4) == "<ref"){
			pos += 4;
			var text = content.slice(pos);
			var posEnd = text.search(/<\/ref>|\/>/);
			endTime("parseRef",start);
			if (text.slice(posEnd, posEnd + 6) == "</ref>")
				return {text: text.slice(0, posEnd), pos: pos + posEnd + 6};
			else
				return {text: text.slice(0, posEnd), pos: pos + posEnd + 2};
		} 
		endTime("parseRef",start);
		return {text: null, pos: pos};
	}

	function firstPass(content){
		var start = startTime();
		var parsed = "";
		var pos = 0;
		var out;
		
		while (pos < content.length){

			if (content[pos] == "<"){
				// Parse comment.
				out = parseSimpleTag(content, pos, "<!--", "-->");
				if (out.text != null){
					pos = out.pos;
					continue;
				}
			}

			if (content[pos] == "{"){
				// Parse table.
				out = parseSimpleTag(content, pos, "{|", "|}");
				if (out.text != null){
					pos = out.pos;
					continue;
				}
			}
			
			// skip ahead
			var priorPos = pos;
			var commentPos = content.indexOf('<',(pos+1));
			var tablePos = content.indexOf('{',(pos+1));
			if (commentPos != -1 && (commentPos < tablePos || tablePos == -1))
				pos = commentPos;
			if (tablePos != -1 && (tablePos < commentPos || commentPos == -1))
				pos = tablePos;
			if (commentPos == -1 && tablePos == -1)
				pos = content.length;
				
			if (priorPos != pos)
				parsed += content.slice(priorPos,pos);
				
				
			// parsed += content[pos];
			// pos++;
		}

		endTime("firstPass",start);
		return parsed;
	}
	
	function secondPass(content){
		var start = startTime();
		var parsed = "";
		var pos = 0;
		var out;

		while (pos < content.length){
			
			if (content[pos] == "<"){
				out = parseRef(content, pos);
				if (out.text != null){
					pos = out.pos;
					continue;
				}
			}

			if (content[pos] == "["){
				out = parseLink(content, pos);
				if (out.text != null){
					pos = out.pos;
					parsed += out.text;
					continue;
				}
			}

			// skip ahead
			var priorPos = pos;
			var refPos = content.indexOf('<',(pos+1));
			var linkPos = content.indexOf('[',(pos+1));
			if (refPos != -1 && (refPos < linkPos || linkPos == -1))
				pos = refPos;
			if (linkPos != -1 && (linkPos < refPos || refPos == -1))
				pos = linkPos;
			if (refPos == -1 && linkPos == -1)
				pos = content.length;
				
			if (priorPos != pos)
				parsed += content.slice(priorPos,pos);
			
			// parsed += content[pos];
			// pos++;
		}

		endTime("secondPass",start);
		return parsed;
	}


	// Strip bold and italic characters from paragraph. */
	function boldItalicPass(content){
		var start = startTime();
		var toggle = [];
		var countItalic = 0, countBold = 0;

		var tmp = content;
		var i = 0, pos = 0;
		// First pass to determine default toggle positions.
		while (true){
			i = tmp.search(/''([^']|$)/);
			if (i === -1)
				break;

			pos += i;
			if (tmp.slice(i - 3, i) === "'''"){
				toggle.push({pos: pos - 3, type: "b"});
				toggle.push({pos: pos, type: "i"});
				countBold += 1;
				countItalic += 1;
			} else if (tmp[i - 1] === "'"){
				toggle.push({pos: pos - 1, type: "b"});
				countBold += 1;
			} else {
				toggle.push({pos: pos, type: "i"});
				countItalic += 1;
			}
			pos += 2;
			tmp = tmp.slice(i + 2);
		}

		// Treat special cases if both number of toggles odd.
		if ((countBold % 2) + (countItalic % 2) === 2)
			for (i = 0; i < (toggle.length-1); i++)
				if (toggle[i].type === "b" && toggle[i + 1].pos - toggle[i].pos !== 3){
					pos = toggle[i].pos;
					if ((content[pos - 2] === " " && content[pos - 2] !== " ") 
					|| (content[pos - 2] !== " " && content[pos - 2] !== " ") 
					|| (content[pos - 2] === " ")){
						toggle[i].pos += 1;
						toggle[i].type = "i";
						countBold -= 1;
						countItalic += 1;
					}
					break;
				}

		// Add missing toggles at the end.
		if (countItalic % 2 === 1){
			toggle.push({pos: content.length, type: 'i'});
			content += "''";
		}
		if (countBold % 2 === 1)
			toggle.push({pos: content.length, type: 'b'});

		// Remove toggles.
		var parsed = "";
		if (toggle.length !== 0){
			pos = 0;
			for (i = 0; i < toggle.length; i++){
				parsed += content.slice(pos, toggle[i].pos);
				if (toggle[i].type === "b"){
					pos = toggle[i].pos + 3;
				} else
					pos = toggle[i].pos + 2;
			}
			if (content.slice(content.length - 2, content.length) !== "''")
				parsed += content.slice(pos, content.length);
		} else
			parsed = content;
			
		endTime("boldItalicPass",start);
		return parsed;
	}

	function stripWhitespace(content){
		var start = startTime();
		var parsed = "";

		content = content.replace(/ +/g, " ");

		var blocks = content.split("\n");
		for (var i = 0; i < blocks.length; i++){
			if (blocks[i].match(/^\s*$/)){
				parsed += "\n\n";
			}
			else if (blocks[i].match(/^==+.+==+$/))
				parsed += blocks[i] + "\n";
			else
				parsed += blocks[i];
		}

		parsed = parsed.replace(/\n\n+/g, "\n\n");
		parsed = parsed.replace(/(^\n*|\n*$)/g, "");
		
		endTime("stripWhitespace",start);
		return parsed;
	}

	var txtwiki = {parseWikitext : parseWikitext, getTimes : getTimes, resetTimes : resetTimes };

	if (typeof module !== 'undefined' && module.exports)
		module.exports = txtwiki;
	else
		return txtwiki;
}());
