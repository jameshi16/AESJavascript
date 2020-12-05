# AESJavascript 

A bad implementation of AES-128 & MD5 in JavaScript for educational purposes (i.e. do not use for production). The AES algorithm is implemented in neither CBC or ECB mode; it's just good old pure AES.

---

## AES Usage

To use (i.e. test, don't use this script in a production system) the AES functions in `aes.js`, include the JS file in a HTML file like this:

```html
<script src="./aes.js"></script>
```

Then, obtain a 128-bit (that's 16 bytes in most systems) key and 128-bit message.

Next, break up your 128-bit key and message into blocks of 4 words (that's four 32-bit chunks). If you are working with hexadecimal, take note of the endianness of your system when you arrange the hex digits. Chances are, your system is using the little endian byte representation.

For example, if your 128-bit key has the hex `0x00112233445566778899AABBCCDDEEFF`, then on a little endian system, you'll break them up to be `0x33221100`, `0x77665544`, `0xBBAA9988`, `0xFFEEDDCC`.

Taking `m` as your message, in the form of an array of words, where `m[0]` represents the most significant word of your message, and `k` as your key, in the form of an array of words, where `k[0]` represents the most significant word of your key, then:

```js
aesEncrypt(m[0], m[1], m[2], m[3], k[0], k[1], k[2], k[3]);
```

Will return a ciphertext `c`, in the form of an array of words, where `c[0]` represents the most significant word of the resulting ciphertext.

Similarly,

```js
aesDecrypt(c[0], c[1], c[2], c[3], k[0], k[1], k[2], k[3]);
```
will return `m`.

## MD5 Usage

Do not use in a production system. Include the relevant JS file in a HTML file like this:

```html
<script src="./md5.js"></script>
```

Then, call the MD5 function like so:
```js
const md5Raw = md5("any string message"); // returns an ArrayBuffer object of size 16
console.log(md5ToHex(md5Raw)); // prints hexadecimal representation of MD5
```

---

# License

[WTFPL](./LICENSE).
