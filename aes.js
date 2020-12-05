const roundConstants = [ 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36 ];
const sBox = new Array(256);
const inverseSBox = new Array(256);
function initSBox() {
	// mainly copied from wikipedia
	let p = 1, q = 1;

	do {
		p = (p ^ ((p << 1) % 2**8) ^ (p & 0x80 ? 0x11B : 0)) % 2**8;

		q ^= q << 1;
		q ^= q << 2;
		q ^= q << 4;
		// https://math.stackexchange.com/a/1231243 for why 0x09
		q ^= (q) & 0x80 ? 0x09 : 0;
		q %= 2**8;

		// sbox
		const xformed = q ^ circularShift(q, 1) ^ circularShift(q, 2) ^ circularShift(q, 3) ^ circularShift(q, 4);
		sBox[p] = xformed ^ 0x63;

		// inverse sbox
		inverseSBox[sBox[p]] = p;
	} while (p != 1);

	sBox[0] = 0x63;
	inverseSBox[0x63] = 0x00;
}
initSBox();

// xor no carry multiply
function multiply(a, b) {
	let p = 0;

	for (let i = 0; i < 8; i++) {
		if (b & 1 !== 0) {
			p ^= a;
		}

		const exceed = a & 0x80;
		a <<= 1;
		if (exceed) {
			a ^= 0x1B;
			a %= 2**8;
		}
		b >>= 1;
	}

	return p;
}

function circularShift(b, n) {
	return (b << n | b >>> (8 - n)) % 2**8;
}

function subWord(b1, b2, b3, b4) {
	return [ sBox[b1], sBox[b2], sBox[b3], sBox[b4] ];
}

function subInvWord(b1, b2, b3, b4) {
	return [ inverseSBox[b1], inverseSBox[b2], inverseSBox[b3], inverseSBox[b4] ];
}

function breakupWord(b) {
	return [ b >>> 24, (b >>> 16) & 0x00FF, (b >>> 8) & 0x0000FF, b & 0x000000FF ];
}

function rotWord(b1, b2, b3, b4) {
	return [b4, b1, b2, b3];
}

function combineWord(b1, b2, b3, b4) {
	return b1 << 24 | b2 << 16 | b3 << 8 | b4;
}

function keyExpansion(k1, k2, k3, k4) {
	// Technically, I can re-write the key expansion such that we don't need so many iterations
	// in the inner function. However, this method is clearer, probably, maybe.
	const cache = (new Array(4 * 11)).fill(null);
	let roundNo = 0; // the round number, which increases every 4 words
	
	// fill cache with first 16 bytes from the key
	cache[0] = k1;
	cache[1] = k2;
	cache[2] = k3;
	cache[3] = k4;

	function keyExpansionInner(k1, k2, k3, k4, i) {
		if (cache[i] !== null) {
			return cache[i];
		}

		if (i >= 4 && i % 4 === 0) {
			const rotatedWord = rotWord(k1, k2, k3, k4);
			const subbedWord = subWord(rotatedWord[0], rotatedWord[1], rotatedWord[2], rotatedWord[3]);

			return keyExpansionInner(k1, k2, k3, k4, i - 4) ^ combineWord(subbedWord[0], subbedWord[1], subbedWord[2], subbedWord[3]) ^ roundConstants[roundNo++];
		} else {
			return keyExpansionInner(k1, k2, k3, k4, i - 4) ^ keyExpansionInner(k1, k2, k3, k4, i - 1);
		}
	}

	for (let i = 4; i < 4 * 11; i++) {
		const previousKey = breakupWord(cache[i - 1]);
		cache[i] = keyExpansionInner(previousKey[0], previousKey[1], previousKey[2], previousKey[3], i);
	}
	return cache;
}

function addRoundKey(roundKeys, state, roundNo) {
	const k1 = roundKeys[roundNo * 4];
	const k2 = roundKeys[roundNo * 4 + 1];
	const k3 = roundKeys[roundNo * 4 + 2];
	const k4 = roundKeys[roundNo * 4 + 3];

	const s1 = state[0];
	const s2 = state[1];
	const s3 = state[2];
	const s4 = state[3];

	return [k1 ^ s1, k2 ^ s2, k3 ^ s3, k4 ^ s4];
}

function subBytes(state) {
	const a1 = breakupWord(state[0]);
	const a2 = breakupWord(state[1]);
	const a3 = breakupWord(state[2]);
	const a4 = breakupWord(state[3]);

	const b1 = combineWord(...subWord(a1[0], a1[1], a1[2], a1[3]));
	const b2 = combineWord(...subWord(a2[0], a2[1], a2[2], a2[3]));
	const b3 = combineWord(...subWord(a3[0], a3[1], a3[2], a3[3]));
	const b4 = combineWord(...subWord(a4[0], a4[1], a4[2], a4[3]));

	return [b1, b2, b3, b4];
}

function invSubBytes(state) {
	const a1 = breakupWord(state[0]);
	const a2 = breakupWord(state[1]);
	const a3 = breakupWord(state[2]);
	const a4 = breakupWord(state[3]);

	const b1 = combineWord(...subInvWord(a1[0], a1[1], a1[2], a1[3]));
	const b2 = combineWord(...subInvWord(a2[0], a2[1], a2[2], a2[3]));
	const b3 = combineWord(...subInvWord(a3[0], a3[1], a3[2], a3[3]));
	const b4 = combineWord(...subInvWord(a4[0], a4[1], a4[2], a4[3]));

	return [b1, b2, b3, b4];
}

function shiftRows(state) {
	const a1 = breakupWord(state[0]);
	const a2 = breakupWord(state[1]);
	const a3 = breakupWord(state[2]);
	const a4 = breakupWord(state[3]);

	const s1 = combineWord(a4[0], a3[1], a2[2], a1[3]);
	const s2 = combineWord(a1[0], a4[1], a3[2], a2[3]);
	const s3 = combineWord(a2[0], a1[1], a4[2], a3[3]);
	const s4 = combineWord(a3[0], a2[1], a1[2], a4[3]);

	return [s1, s2, s3, s4];
}

function invShiftRows(state) {
	const a1 = breakupWord(state[0]);
	const a2 = breakupWord(state[1]);
	const a3 = breakupWord(state[2]);
	const a4 = breakupWord(state[3]);

	const s1 = combineWord(a2[0], a3[1], a4[2], a1[3]);
	const s2 = combineWord(a3[0], a4[1], a1[2], a2[3]);
	const s3 = combineWord(a4[0], a1[1], a2[2], a3[3]);
	const s4 = combineWord(a1[0], a2[1], a3[2], a4[3]);

	return [s1, s2, s3, s4];
}

function mixColumns(state) {
	const buffer = new Array(4);

	function innerMixColumns(a1, a2, a3, a4) {
		const b1 = multiply(a4, 2) ^ multiply(a3, 3) ^ a2 ^ a1;
		const b2 = a4 ^ multiply(a3, 2) ^ multiply(a2, 3) ^ a1;
		const b3 = a4 ^ a3 ^ multiply(a2, 2) ^ multiply(a1, 3);
		const b4 = multiply(a4, 3) ^ a3 ^ a2 ^ multiply(a1, 2);

		return [b4, b3, b2, b1];
	}

	for (let i = 0; i < 4; i++) {
		const brokenWord = breakupWord(state[i]);			
		const mixedWord = innerMixColumns(brokenWord[0], brokenWord[1], brokenWord[2], brokenWord[3]);
		buffer[i] = combineWord(mixedWord[0], mixedWord[1], mixedWord[2], mixedWord[3]);
	}
	return buffer;
}

function inverseMixColumns(state) {
	const buffer = new Array(4);

	function innerInverseMixColumns(a1, a2, a3, a4) {
		const b1 = multiply(a4, 14) ^ multiply(a3, 11) ^ multiply(a2, 13) ^ multiply(a1, 9);
		const b2 = multiply(a4, 9) ^ multiply(a3, 14) ^ multiply(a2, 11) ^ multiply(a1, 13);
		const b3 = multiply(a4, 13) ^ multiply(a3, 9) ^ multiply(a2, 14) ^ multiply(a1, 11);
		const b4 = multiply(a4, 11) ^ multiply(a3, 13) ^ multiply(a2, 9) ^ multiply(a1, 14);

		return [b4, b3, b2, b1];
	}

	for (let i = 0; i < 4; i++) {
		const brokenWord = breakupWord(state[i]);
		const mixedWord = innerInverseMixColumns(brokenWord[0], brokenWord[1], brokenWord[2], brokenWord[3]);
		buffer[i] = combineWord(mixedWord[0], mixedWord[1], mixedWord[2], mixedWord[3]);
	}
	return buffer;
}

const testVectorRoundKeys = keyExpansion(0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c);
const testVectorState = [0x33221100, 0x77665544, 0xbbaa9988, 0xffeeddcc];
const testVectorRoundOne = addRoundKey(testVectorRoundKeys, testVectorState, 0);
const testVectorSubBytes = subBytes(testVectorRoundOne);
const testVectorShiftRows = shiftRows(testVectorSubBytes);
const testVectorMixColumns = mixColumns(testVectorShiftRows);
const testVectorRoundEnd = addRoundKey(testVectorRoundKeys, testVectorMixColumns, 1);

const completeTestVector = (() => {
	let state = testVectorRoundOne;
	for (let i = 0; i < 9; i++) {
		state = addRoundKey(testVectorRoundKeys, mixColumns(shiftRows(subBytes(state))), i + 1);
	}
	state = addRoundKey(testVectorRoundKeys, shiftRows(subBytes(state)), 10);
	return state;
})();

const completeInverseTestVector = (() => {
	let state = completeTestVector;
	state = addRoundKey(testVectorRoundKeys, state, 10);
	for (let i = 8; i >= 0; i--) {
		state = inverseMixColumns(addRoundKey(testVectorRoundKeys, invSubBytes(invShiftRows(state)), i + 1));
	}
	state = addRoundKey(testVectorRoundKeys, invSubBytes(invShiftRows(state)), 0);
	return state;
})();

function aesEncrypt(m1, m2, m3, m4, k1, k2, k3, k4) {
	const roundKeys = keyExpansion(k1, k2, k3, k4);
	let state = [m1, m2, m3, m4];
	state = addRoundKey(roundKeys, state, 0);
	for (let i = 0; i < 9; i++) {
		state = addRoundKey(roundKeys, mixColumns(shiftRows(subBytes(state))), i + 1);
	}
	state = addRoundKey(roundKeys, shiftRows(subBytes(state)), 10);
	return state;
}

function aesDecrypt(c1, c2, c3, c4, k1, k2, k3, k4) {
	const roundKeys = keyExpansion(k1, k2, k3, k4);
	let state = [c1, c2, c3, c4];
	state = addRoundKey(roundKeys, state, 10);
	for (let i = 8; i >= 0; i--) {
		state = inverseMixColumns(addRoundKey(roundKeys, invSubBytes(invShiftRows(state)), i + 1));
	}
	state = addRoundKey(roundKeys, invSubBytes(invShiftRows(state)), 0);
	return state;
}
