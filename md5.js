function md5(message) {
	// turn message into numbers
	// the buffer length must be long enough:
	// 1) The message length (can assume that it ends on a byte and not on any random bit)
	// 2) At least 1 byte for the 0x80 to end the message
	// 3) At least 8 bytes to indicate the message length
	// Steps 1 & 2 must then be padded enough such that the last 8 bytes contain the message length.

	const padLength = (message.length % 64) > 56 ? 120 - (message.length % 64) : 56 - (message.length % 64);
	const bufLen = message.length + padLength + 8;
	const buf = new ArrayBuffer(bufLen);
	const bufView = new Uint8Array(buf);
	for (let i = 0; i < message.length; i++) {
		bufView[i] = message.charCodeAt(i) % 256; // no unicode support
	}

	// add that 1 bit
	bufView[message.length] = 0x80;

	// fill with 0s until only 64 bits left (a.k.a 8 bytes)
	// (in our case, just zero everything. we'll write the length to the right place)
	bufView.fill(0x00, message.length + 1);

	// length of original message
	new DataView(buf).setBigUint64(message.length + padLength, BigInt(message.length * 8) % BigInt(2**64), true);

	// md buffer (A, B, C and D)
	const mdBuffers = new ArrayBuffer(4 * 4);
	const mdBuffersView = new Uint32Array(mdBuffers);
	mdBuffersView[0] = 0x67452301;
	mdBuffersView[1] = 0xefcdab89;
	mdBuffersView[2] = 0x98badcfe;
	mdBuffersView[3] = 0x10325476;

	// auxillary functions
	const F = (X, Y, Z) => (X & Y) | (~X & Z);
	const G = (X, Y, Z) => (X & Z) | (Y & ~Z);
	const H = (X, Y, Z) => X ^ Y ^ Z;
	const I = (X, Y, Z) => Y ^ (X | ~Z);
	const leftRotate = (x, c) => (x << c) | (x >>> (32 - c));

	// sine table (copied from wikipedia for ease)
	const T = [
		0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
		0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
		0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
		0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
		0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
		0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
		0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
		0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
		0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
		0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
		0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
		0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
		0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
		0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
		0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
		0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
	];

	// per-round shifts (copied from wikipedia for ease)
	const S = [
		7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
		5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
		4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
		6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
	];

	for (let i = 0; i < buf.byteLength / 64; i++) {
		const M = new Uint32Array(buf.slice(i * 64, i * 64 + 64));

		// copy A, B, C and D
		const tempMdBuffers = new Uint32Array(4);
		tempMdBuffers[0] = mdBuffersView[0];
		tempMdBuffers[1] = mdBuffersView[1];
		tempMdBuffers[2] = mdBuffersView[2];
		tempMdBuffers[3] = mdBuffersView[3];

		for (let j = 0; j < 64; j++) {
			const indexA = (0 + j * 3) % 4;
			const indexB = (1 + j * 3) % 4;
			const indexC = (2 + j * 3) % 4;
			const indexD = (3 + j * 3) % 4;
			let roundFunc = null;
			let messageIndex = null;

			if (j >= 0 && j <= 15) {
				roundFunc = F;
				messageIndex = j;
			}
			
			if (j >= 16 && j <= 31) {
				roundFunc = G;
				messageIndex = (5 * j + 1) % 16;
			}

			if (j >= 32 && j <= 47) {
				roundFunc = H;
				messageIndex = (3 * j + 5) % 16;
			}

			if (j >= 48 && j <= 63) {
				roundFunc = I;
				messageIndex = (7 * j) % 16;
			}

			tempMdBuffers[indexA] = tempMdBuffers[indexB] + leftRotate(tempMdBuffers[indexA]
				+ roundFunc(tempMdBuffers[indexB], tempMdBuffers[indexC], tempMdBuffers[indexD])
				+ M[messageIndex]
				+ T[j], S[j]);
		}

		mdBuffersView[0] += tempMdBuffers[0];
		mdBuffersView[1] += tempMdBuffers[1];
		mdBuffersView[2] += tempMdBuffers[2];
		mdBuffersView[3] += tempMdBuffers[3];
	}

	return mdBuffers;
}

function md5ToHex(md5Output) {
	return Array.prototype.map.call(new Uint8Array(md5Output), x => ('0' + x.toString(16)).slice(-2)).join('');
}
