/* GBS_UI_1_general.js */

/**
	@file General utility functions, UI functions and Unified Search Query parser.
	@author BIOWP
*/

var LOGICAL_OPERATORS = {
	',': 0,	':': 0, ';': 0, // OR
	'&': 1, '|': 1, // AND
	'!': 2 // NOT
};
var SELECTORS = ['*', '?'];
var acceptedNumericalAttributes = [
	'cp', 'atkiv', 'defiv', 'stmiv', 'level', 'dex',
	'baseAtk', 'baseDef', 'baseStm', 'rating',
	'power', 'duration', 'dws', 'energyDelta', 'value'
];

var DialogStack = [];


/**
	Round the value.
	@param {number} Value to round.
	@param {number} numDigits The number of digits to keep.
	@return {number} The rounded value.
*/
function round(value, numDigits){
	var multiplier = Math.pow(10, parseInt(numDigits) || 0);
	return Math.round(value * multiplier) / multiplier;
}

/**
	Generate all the combinations for a given list of elements.
	@param {Object[]} arr The list of elements.
	@param {number} n The number of elements in each combination.
	@param {number} start The starting index. Default to 0.
	@return {Object[][]} A list of all combinations. Each combination is a list itself.
*/
function Combination(arr, n, start){
	start = start || 0;
	if (n == 0){
		return [[]];
	}
	var combinations = [];
	for (var i = start; i < arr.length; i++){
		for (let c2 of Combination(arr, n - 1, i + 1)){
			var c = [arr[i]];
			for (let e of c2){
				c.push(e);
			}
			combinations.push(c);
		}
	}
	return combinations;
}

/**
	Generate all the permutations for a given list of elements.
	@param {Object[]} arr The list of elements.
	@param {number} n The number of elements in each permutation.
	@param {number} start The starting index. Default to 0.
	@return {Object[][]} A list of all permutations. Each permutation is a list itself.
*/
function Permutation(arr, n, start){
	start = start || 0;
	if (n == 0){
		return [[]];
	}
	var permutations = [];
	for (var i = start; i < arr.length; i++){
		let temp = arr[start];
		arr[start] = arr[i];
		arr[i] = temp;
		for (let p2 of Permutation(arr, n - 1, start + 1)){
			var p = [arr[start]];
			p = p.concat(p2);
			permutations.push(p);
		}
		arr[i] = arr[start];
		arr[start] = temp;
	}
	return permutations;
}

/**
	Create a document element.
	@param {string} type The name tag of the element. E.g., "input", "button", "div"
	@param {string} innerHTML The initial value of innerHTML of the element to create. Default to empty string "".
	@param {Object} attrsAndValues Name-value pairs to add additional attributes to the element.
	@return {HTMLElement} The HTML element created.
*/
function createElement(type, innerHTML, attrsAndValues){
	var e = document.createElement(type);
	e.innerHTML = innerHTML || "";
	for (var attr in attrsAndValues){
		e.setAttribute(attr, attrsAndValues[attr]);
	}
	return e;
}


function createRow(rowData, type){
	type = type || "td";
	var row = document.createElement("tr");
	for (var i = 0; i < rowData.length; i++){
		var d = document.createElement(type);
		d.innerHTML = rowData[i];
		row.appendChild(d);
	}
	return row;
}


function toTitleCase(str){
	str = str || "";
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}


function traverseLeaf(json, callback, path){
	path = path || [];
	if (typeof json == typeof "" || typeof json == typeof 0){
		callback(json, path);
		return;
	}
	for (let key of Object.keys(json)){
		traverseLeaf(json[key], callback, path.concat([key]));
	}
}


function getProperty(json, path){
	for (var i = 0; i < path.length; i++){
		json = json[path[i]];
	}
	return json;
}


function setProperty(json, path, value){
	for (var i = 0; i < path.length - 1; i++){
		json = json[path[i]];
	}
	json[path[path.length - 1]] = value;
}

// https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
var copyToClipboard = str => {
  const el = document.createElement('textarea');  // Create a <textarea> element
  el.value = str;                                 // Set its value to the string that you want copied
  el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
  el.style.position = 'absolute';                 
  el.style.left = '-9999px';                      // Move outside the screen to make it invisible
  document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
  const selected =            
    document.getSelection().rangeCount > 0        // Check if there is any content selected previously
      ? document.getSelection().getRangeAt(0)     // Store selection if found
      : false;                                    // Mark as false to know no selection existed before
  el.select();                                    // Select the <textarea> content
  document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
  document.body.removeChild(el);                  // Remove the <textarea> element
  if (selected) {                                 // If a selection existed before copying
    document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
    document.getSelection().addRange(selected);   // Restore the original selection
  }
};


function getCookie(name){
	for (let pair of document.cookie.split(";")){
		kv = pair.split("=");
		if (kv[0].trim() == name){
			return kv[kv.length - 1].trim();
		}
	}
}


function jsonToURI(json){ 
	return encodeURIComponent(JSON.stringify(json));
}


function uriToJSON(urijson){
	return JSON.parse(decodeURIComponent(urijson)); 
}


// A generic function to read structured input from HTML elements
function read(node){
	node = node || document.getElementById("input");
	let output = {};
	let nameSegments = (node.getAttribute("name") || "").split("-");
	if (nameSegments.length >= 2){
		let attrName = nameSegments[1];
		let tagName = node.tagName.toLowerCase();
		if (tagName == "input" || tagName == "select"){
			output[attrName] = (node.type == "checkbox" ? node.checked : node.value);
			if (node.type == "number"){
				output[attrName] = parseFloat(output[attrName]) || 0;
			}
		}else{
			let childOutputs = [];
			for (let child of node.children){
				childOutputs.push(read(child));
			}
			output[attrName] = childOutputs;
		}
	}else{
		for (let child of node.children){
			let childOutput = read(child);
			for (var attr in childOutput){
				output[attr] = childOutput[attr];
			}
		}
	}
	return output;
}

// A generic function to write structured input to HTML elements
// When [forced] is true, this function will update elements with empty value if [config] doesn't contain the attribute
function write(node, config, forced){
	let nameSegments = (node.getAttribute("name") || "").split("-");
	if (nameSegments.length >= 2){
		let attrName = nameSegments[1];
		if (config.hasOwnProperty(attrName) || forced){
			let tagName = node.tagName.toLowerCase();
			if (tagName == "input" || tagName == "select"){
				if (node.type == "checkbox"){
					node.checked = config[attrName] || false;
				}else{
					if (typeof config[attrName] == typeof {}){
						try{
							node.value = JSON.stringify(config[attrName]);
						}catch(err){
							node.value = "";
						}
					} else {
						node.value = config[attrName] || "";
					}
				}
				if (node.onchange){
					node.onchange();
				}
			}else{
				let nodeConstructor = getConstructor(attrName);
				if (nodeConstructor){
					node.innerHTML = "";
					for (let childConfig of config[attrName]){
						let childNode = new nodeConstructor();
						node.appendChild(childNode);
						write(childNode, childConfig, forced);
					}
				}
			}
		}
	}else{
		for (let child of node.children){
			write(child, config, forced);
		}
	}
}

// Helper function for write()
function getConstructor(attrName){
	if (attrName == "players"){
		return createPlayerNode;
	}else if (attrName == "parties"){
		return createPartyNode;
	}else if (attrName == "pokemon"){
		return createPokemonNode;
	}
}

// A generic function for formatting select HTML elements input
function formatting(node){
	let name = node.getAttribute("name") || "";
	if (name.includes("-name") || name.includes("-fmove") || name.includes("-cmove")){
		node.value = toTitleCase(node.value);
	}
	if ($(node).data("ui-autocomplete")){
		$(node).data("ui-autocomplete")._trigger("change");
	}else if ($(node).data("ui-checkboxradio")){
		$(node).button("refresh");
	}
	for (let child of node.children){
		formatting(child);
	}
}




function Predicate(pd, parent, attr){
	return createComplexPredicate(pd, parent, attr);
}


function parseNumericalRange(str){
	if (!isNaN(parseFloat(str))){
		return ['value', str];
	}
	for (var i = 0; i < acceptedNumericalAttributes.length; i++){
		var attr = acceptedNumericalAttributes[i];
		if (str.substring(0, attr.length) == attr.toLowerCase())
			return [attr, str.slice(attr.length)];
	};
	return ['', str];
}


function createSimplePredicate(str, parent, attr){
	str = str.trim();
	
	var numericalParameters = parseNumericalRange(str.toLowerCase());
	if (numericalParameters[0] != ''){ // Match numerical attributes
		var bounds = numericalParameters[1].split((numericalParameters[1].includes('~') ? '~' : '-'));
		const num_attr = numericalParameters[0], 
			LBound = parseFloat(bounds[0]) || -1000000, 
			UBound = parseFloat(bounds[bounds.length-1]) || 1000000;
		return function(obj){
			return LBound <= obj[num_attr] && obj[num_attr] <= UBound;
		};
	}else if (Data.TypeEffectiveness.hasOwnProperty(str.toLowerCase()) || str.toLowerCase() == 'none'){ // Match types
		const str_const = str.toLowerCase();
		return function(obj){
			return ([obj.pokeType, obj.pokeType1, obj.pokeType2].includes(str_const));
		};
	}else if (str[0] == '@'){ // Match moves
		str = str.slice(1).toLowerCase();
		if (str.substring(0,3) == '<f>'){
			str = str.slice(3);
			return function(obj){
				var fmove = (typeof obj.fmove == typeof "" ? getEntry(obj.fmove, Data.FastMoves) : obj.fmove);
				pred_move = createSimplePredicate(str, obj, attr);
				return fmove && pred_move(fmove);
			};
		}else if (str.substring(0,3) == '<c>'){
			str = str.slice(3);
			return function(obj){
				var cmove = (typeof obj.cmove == typeof "" ? getEntry(obj.cmove, Data.ChargedMoves) : obj.cmove);
				pred_move = createSimplePredicate(str, obj, attr);
				return cmove && pred_move(cmove);
			};
		}else if (str.substring(0,3) == '<*>'){
			str = str.slice(3);
			return function(obj){
				var fmove = (typeof obj.fmove == typeof "" ? getEntry(obj.fmove, Data.FastMoves) : obj.fmove);
				var cmove = (typeof obj.cmove == typeof "" ? getEntry(obj.cmove, Data.ChargedMoves) : obj.cmove);
				pred_move = createSimplePredicate(str, obj, attr);
				return (fmove && pred_move(fmove)) && (cmove && pred_move(cmove));
			};
		}else{
			return function(obj){
				var fmove = (typeof obj.fmove == typeof "" ? getEntry(obj.fmove, Data.FastMoves) : obj.fmove);
				var cmove = (typeof obj.cmove == typeof "" ? getEntry(obj.cmove, Data.ChargedMoves) : obj.cmove);
				pred_move = createSimplePredicate(str, obj, attr);
				return (fmove && pred_move(fmove)) || (cmove && pred_move(cmove));
			};
		}
	}else if (str[0] == '$'){ // Box
		const str_const = str.slice(1).trim();
		return function(obj){
			return obj.uid && (!str_const || obj.nickname.includes(str_const));
		};
	}else if (str[0] == '%'){ // Raid Boss
		const str_const = str.slice(1);
		return function(obj){
			return obj.raidMarker && obj.raidMarker.includes(str_const);
		};
	}else if (str[0] == '+'){ // Evolutions
		const evolutions_const = getAllEvolutions(str.slice(1).trim().toLowerCase());
		return function(obj){
			return evolutions_const.includes(obj.name);
		};
	}else if (str.toLowerCase() == "evolve"){ // The Pokemon has evolution
		return function(obj){
			return obj.evolutions && obj.evolutions.length > 0;
		};
	}else if (str.toLowerCase() == "current"){ // Current Move
		return function(obj){
			return parent && parent[obj.moveType + "Moves"].includes(obj.name);
		};
	}else if (str.toLowerCase() == "legacy"){ // Legacy Move
		return function(obj){
			return parent && parent[obj.moveType + "Moves_legacy"].includes(obj.name);
		};
	}else if (str.toLowerCase() == "exclusive"){ // Exclusive Move
		return function(obj){
			return parent && parent[obj.moveType + "Moves_exclusive"].includes(obj.name);
		};
	}else{ // Match name/nickname/species
		const str_const = str.toLowerCase();
		return function(obj){
			if (obj.name && obj.name.includes(str_const))
				return true;
			return obj.label && obj.label.toLowerCase().includes(str_const);
		}
	}
}



function tokenize(str, specialChars, escapeChar){
	var tokens = [];
	var cur = "";
	var escaped = false;
	for (var i = 0; i < str.length; i++) {
		var c = str[i];
		if (escaped) {
			cur += c;
			escaped = false;
		} else if (c == escapeChar) {
			escaped = true;
		} else if (specialChars.includes(c)) {
			cur = cur.trim();
			if (cur) {
				tokens.push(cur);
				cur = "";
			}
			tokens.push(c);
		} else {
			cur += c;
		}
	}
	cur = cur.trim();
	if (cur) {
		tokens.push(cur);
	}
	return tokens;
}


function createComplexPredicate(expression, parent, attr){
	var defaultPredicate = arg => false;
	var vstack = [], opstack = [];
	
	function evalSimple(op, stack) {
		if (op == ',' || op == ':' || op == ';') {
			var rhs = stack.pop() || defaultPredicate, lhs = stack.pop() || defaultPredicate;
			return arg => lhs(arg) || rhs(arg);
		} else if (op == '&' || op == '|') {
			var rhs = stack.pop() || defaultPredicate, lhs = stack.pop() || defaultPredicate;
			return arg => lhs(arg) && rhs(arg);
		} else if (op == '!') {
			var rhs = stack.pop() || defaultPredicate;
			return arg => !rhs(arg);
		} else {
			return defaultPredicate;
		}
	}
	
	for (let tk of tokenize(expression, Object.keys(LOGICAL_OPERATORS).concat(['(', ')']), '^')) {
		if (LOGICAL_OPERATORS.hasOwnProperty(tk)) {
			var top_op = opstack[opstack.length - 1];
			if (top_op && top_op != '(' && LOGICAL_OPERATORS[tk] <= LOGICAL_OPERATORS[top_op]) {
				vstack.push(evalSimple(opstack.pop(), vstack));
			} 
			opstack.push(tk);
		} else if (tk == '(') {
			opstack.push('(');
		} else if (tk == ')') {
			while (opstack.length) {
				var op = opstack.pop();
				if (op == ')')
					break;
				vstack.push(evalSimple(tk, vstack));
			}
		} else {
			vstack.push(createSimplePredicate(tk, parent, attr));
		}
	}
	while (opstack.length) {
		vstack.push(evalSimple(opstack.pop(), vstack));
	}
	
	return vstack.pop() || defaultPredicate;
}


function getAllEvolutions(name){
	var evolutions = [name], pkm = getEntry(name, Data.Pokemon);
	if (pkm){
		for (evo of pkm.evolutions){
			evolutions = evolutions.concat(getAllEvolutions(evo));
		}
	}
	return evolutions;
}


function getPokemonPool(){
	var options = [];
	for (let user of Data.Users){
		for (let pokemon of user.box){
			options.push(pokemon);
		}
	}
	return options.concat(Data.Pokemon);
}


function createPokemonNameInput(){
	var nameInput = createElement('input', '', {
		type: 'text', placeholder: 'Species', class: 'input-with-icon species-input-with-icon', 
		style: 'background-image: url(' + getPokemonIcon({dex: 0}) + ')', name: "pokemon-name"
	});
	$( nameInput ).autocomplete({
		minLength: 0,
		delay: 200,
		source: function(request, response){
			var searchStr = (SELECTORS.includes(request.term[0]) ? request.term.slice(1) : request.term);
			var matches = getPokemonPool().filter(Predicate(searchStr));
			response(matches);
		},
		select: function(event, ui){
			var pkmInfo = ui.item;
			ui.item.value = toTitleCase(ui.item.name);
			let pokemonNode = $(this).parents("[name=pokemon]")[0];
			if (pkmInfo.uid){
				write(pokemonNode, pkmInfo);
				formatting(pokemonNode);
			}
			this.setAttribute('style', 'background-image: url(' + pkmInfo.icon + ')');
			if (pkmInfo.raidMarker){
				let raidTierInput = $(pokemonNode).find("[name=pokemon-raidTier]")[0];
				if (raidTierInput){
					raidTierInput.value = pkmInfo.raidMarker.split(" ")[0];
					raidTierInput.onchange();
				}
			}
		},
		change: function(event, ui){
			if (!ui.item){ // Change not due to selecting an item from menu
				let idx = getEntryIndex(this.value.toLowerCase(), Data.Pokemon);
				this.setAttribute('style', 'background-image: url(' + getPokemonIcon({index: idx}) + ')');
			}
		}
	}).autocomplete( "instance" )._renderItem = _renderAutocompletePokemonItem;

	return nameInput;
}


function createPokemonMoveInput(moveType, attrName){
	var placeholder_ = "";
	if (moveType == "fast"){
		placeholder_ = "Fast Move";
	}else if (moveType == "charged"){
		placeholder_ = "Charged Move";
	}
	let moveInput = createElement('input', '', {
		type: 'text', placeholder: placeholder_, name: "pokemon-" + attrName,
		class: 'input-with-icon move-input-with-icon', style: 'background-image: url()'
	});
	$( moveInput ).autocomplete({
		minLength : 0,
		delay : 0,
		source: function(request, response){
			let pokemonInstance = getEntry($(moveInput).parents("[name=pokemon]").find("[name=pokemon-name]").val().trim().toLowerCase(), Data.Pokemon);
			let searchStr = (SELECTORS.includes(request.term[0]) ? request.term.slice(1) : request.term), matches = [];
			if (searchStr == '' && pokemonInstance){ //special case
				searchStr = 'current, legacy, exclusive';
			}
			matches = Data[toTitleCase(moveType) + "Moves"].filter(Predicate(searchStr, pokemonInstance, attrName));
			response(matches);
		},
		select: function(event, ui) {
			this.setAttribute('style', 'background-image: url(' + ui.item.icon + ')');
		},
		change: function(event, ui) {
			if (!ui.item){ // Change not due to selecting an item from menu
				this.setAttribute('style', 'background-image: url(' + getTypeIcon({mtype: moveType, name: this.value.trim()}) + ')');
			}
		}
	}).autocomplete( "instance" )._renderItem = _renderAutocompleteMoveItem;
	
	moveInput.onfocus = function(){$(this).autocomplete("search", "");};
	
	return moveInput;
}


function addFilterToFooter(table){
	table.columns().flatten().each(function (colIdx){
		table.column(colIdx).footer().innerHTML = "";
		var select = $('<select />')
			.appendTo(
				table.column(colIdx).footer()
			)
			.on( 'change', function (){
				table.column( colIdx ).search( $(this).val() ).draw();
			});
		
		select.append( $("<option value=' '>*</option>") );
		table.column( colIdx ).cache( 'search' ).sort().unique()
			.each( function ( d ) {
				var op = document.createElement('option');
				op.value = d;
				op.innerHTML = d;
				select.append(op);
			});
	});
}


function sendFeedback(msg, appending, feedbackElementId){
	var feedbackEl = document.getElementById(feedbackElementId || "feedback_message");
	if (feedbackEl){
		if (appending){
			feedbackEl.innerHTML += '<p>' + msg + '</p>';
		}else
			feedbackEl.innerHTML = '<p>' + msg + '</p>';
	}
}


function sendFeedbackDialog(msg, dialogTitle){
	var d = $(createElement('div', msg, {
		title: dialogTitle || document.title
	})).dialog({
		buttons: {
			"OK": function(){
				$(this).dialog("close");
			}
		}
	});
	DialogStack.push(d);
	return d;
}


function getTableContent(dt){
	var content = [];
	let r = [];
	let headers = dt.columns().header();
	for (var i = 0; i < headers.length; i++){
		r.push(headers[i].innerText.trim());
	}
	content.push(r);
	
	let attributes = [];
	let dataSrc = dt.columns().dataSrc();
	for (var i = 0; i < dataSrc.length; i++){
		attributes.push(dataSrc[i]);
	}
	var data = dt.rows({search: "applied"}).data();
	for (var i = 0; i < data.length; i++){
		let r = [];
		for (let attr of attributes){
			r.push(createElement("div", data[i][attr]).innerText.trim());
		}
		content.push(r);
	}
	return content;
}


function copyTableToClipboard(elementId){
	var copyStr = "";
	var content = getTableContent($("#" + elementId).DataTable());
	var language = window.navigator.userLanguage || window.navigator.language || "en";
	for (var i = 0; i < content.length; i++){
		for (var j = 0; j < content[i].length; j++){
			let num = parseFloat(content[i][j]);
			if (!isNaN(num)){
				content[i][j] = num.toLocaleString(language);
			}
		}
		copyStr += content[i].join("\t") + "\n";
	}
	copyToClipboard(copyStr);
	sendFeedbackDialog("Table has been copied to clipboard");
}


function exportTableToCSV(elementId, filename){
	filename = filename || "table.csv";
	let csvStr = "data:text/csv;charset=utf-8,";
	var content = getTableContent($("#" + elementId).DataTable());
	var language = window.navigator.userLanguage || window.navigator.language || "en";
	for (var i = 0; i < content.length; i++){
		for (var j = 0; j < content[i].length; j++){
			let num = parseFloat(content[i][j]);
			if (!isNaN(num)){
				content[i][j] = num.toLocaleString(language);
			}
			content[i][j] = '"' + content[i][j] + '"';
		}
		csvStr += content[i].join(",") + "\r\n";
	}
	var encodedUri = encodeURI(csvStr);
	var link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", filename);
	link.innerHTML= "Click Here to download";
	document.body.appendChild(link);
	link.click();
}


function createIconLabelSpan(icon, label, cls){
	return '<span class="input-with-icon ' + cls + '" style="background-image: url(' + icon + ')">' + label + '</span>';
}


function _renderAutocompletePokemonItem(ul, item){
    return $( "<li>" )
        .append( "<div>" + createIconLabelSpan(item.icon, item.label, 'species-input-with-icon') + "</div>" )
        .appendTo( ul );
}


function _renderAutocompleteMoveItem(ul, item){
    return $( "<li>" )
		.append( "<div>" + createIconLabelSpan(item.icon, item.label, 'move-input-with-icon') + "</div>" )
        .appendTo( ul );
}