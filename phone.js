const chrono = require('chrono-node');
require('datejs');

const { SPACE_CHARS, VALID_PUNCTUATION, DIGITS_PAT, DIGITS_RE }  = require('./nlp-helpers');



const SEPARATOR_PAT = `[${VALID_PUNCTUATION}]{1,4}`;
const SEPARATOR_RE = new RegExp(`(${SEPARATOR_PAT})`,'gi');


const MAYBE_PHONE_NUMBER_RE = new RegExp(`${DIGITS_PAT}((${SEPARATOR_PAT})${DIGITS_PAT}){0,6}`,'gi');

const MAX_TOTAL_DIGITS = 15;
const MAX_GROUP_DIGITS = 15;
const MIN_TOTAL_DIGITS = 6;

function validPhoneNumber(candidate) {
	let valid = true;
	const arrGrps = candidate.split(SEPARATOR_RE);
	//* Require first group to be digits, second seps, third digits (alternating, starting and ending with digits)
	// This catches too long separators (>4 spaces ...)
	let gType = true; //true is digits, false is separators 
	let totalDigits = 0;
	let digitsGroups = 0;
	for (const grp of arrGrps) {
		//* Digits group
		if (gType) { 
			if (!grp.match(DIGITS_RE)) {
				valid = false;
				break;
			}
			if (grp.length > MAX_GROUP_DIGITS) {
				valid = false;
				break;
			}
			totalDigits += grp.length;
			digitsGroups += 1;
		} else {
			//Separators validation - if a punctuation (hyphen, dot, other than space is duplicated - not valid)
			const sorted_grp = grp.split('').sort();
			for (var i = 0; i < sorted_grp.length - 1; i++) {
			    if (sorted_grp[i + 1] == sorted_grp[i]) {
			        if (SPACE_CHARS.indexOf(sorted_grp[i]) === -1) {
			        	valid = false;
						break;
			        }
			    }
			}
		}
		gType = !gType;


	} //End for 

	if (totalDigits < MIN_TOTAL_DIGITS || totalDigits > MAX_TOTAL_DIGITS || digitsGroups > 6) {
		valid = false;				
	}

	return valid;
}

// Problem: Phone numbers may look like datetime - (ex: '12-07-2005', '2017 10' from 'Sep 24, 2017 10:30')
// Solution: Use date extractors to disqualfy datetime substrings.
// Problem: The date extractors sometimes detect a part of a phone num is a date: ex: *8-6-90-54504 (a substring is incorrectly detected as a date)
// Solution: Validate chrono dates with datejs + If extracted phone number candidate overlaps an extracted datetime, it is disqualified, unless it contains the entire datetime (longer match wins) 
function validateNotDateTime(mtcText,idxStartMtc,dateMatchs) {
	let valid = true;
	const idxEndMtc = idxStartMtc + mtcText.length;
	for (const dm of dateMatchs) {
		const idxStartDate = dm.index; 
    	const idxEndDate = idxStartDate + dm.text.length;
    	//Doesn't overlap a date
    	if (idxStartMtc > idxEndDate || idxEndMtc < idxStartDate) {
    		continue;
    	}
    	//Overlaps, but contains the date (phone longer match than date) --> still phone
    	if (idxStartMtc <= idxStartDate && idxEndMtc >= idxEndDate && mtcText.length >  dm.text.length) {
    		continue;
    	}
    	//Overlaps (but doesn't contain) --> decide date (not a phone nmumber)
    	valid = false;
    	break;
    }
    return valid;
}

function extractPhoneNumbers(text) {    
    // Collect dates from text that may confuse phone extractor. See validateNotDateTime
    const rawDateMatchs = chrono.strict.parse(text);
    let comp = 0;
    const dateMatchs = [];
    for (const dm of rawDateMatchs) {
    	const valid = Date.parse(dm.text);
    	if (valid) { 
    		dateMatchs.push(dm);
    	}
    }
    const curRe = MAYBE_PHONE_NUMBER_RE;
    let m;
    const phoneNumbers = [];
    while ((m = curRe.exec(text)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === curRe.lastIndex) {
            curRe.lastIndex++;
        }
        const match = m[0];
        if (match && validPhoneNumber(match) && validateNotDateTime(match,m.index,dateMatchs)) {
        	//console.log(match);
        	phoneNumbers.push(match);
        }
        
    } // End while scan text with re
    return phoneNumbers;
}

function main() {
  const phnums = extractPhoneNumbers( 'https://www.forbes.com/sites/amitchowdhry/2018/04/09/microsoft-monday-office-365-advanced-protection-5-billion-for-iot-research-ai-training-courses/#30beb8a4202e');
  console.log(`extractPhoneNumbers: ${JSON.stringify(phnums)}`);
  
}

//main();
module.exports = {
   extractPhoneNumbers,    
}