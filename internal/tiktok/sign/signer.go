package sign

import (
	"crypto/md5"
	"crypto/rc4"
	"encoding/hex"
	"fmt"
	"log"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

type Signer struct{}

const (
	MsToken  = "zGoEuZ69o_ZzPDWycrasRv-Jl5wUPnCESJBOcas3AQp-gU5YTYxmggRxjRRTW9HI9nyp7OUBo6WtwrP9ziEAagNsOnVnZ5Agoi4FYuigRhejhecMYufslhBTMqMWlwLSQgVNz-mNOZUHQeW1332tqSMyDw=="
	InitHash = "d41d8cd98f00b204e9800998ecf8427e"
)

func md5Hex(s string) string {
	hash := md5.Sum([]byte(s))
	return hex.EncodeToString(hash[:])
}

func hexDecodeToBytes(hexStr string) ([]byte, error) {
	return hex.DecodeString(hexStr)
}

func encodeHex(data []byte) string {
	return hex.EncodeToString(data)
}

// func rc4Encrypt(key, data string) string {
// 	var s [256]int
// 	for i := 0; i < 256; i++ {
// 		s[i] = i
// 	}

// 	j := 0
// 	for i := 0; i < 256; i++ {
// 		j = (j + s[i] + int(key[i%len(key)])) % 256
// 		s[i], s[j] = s[j], s[i]
// 	}

// 	result := make([]byte, len(data))
// 	i, j = 0, 0
// 	for k := 0; k < len(data); k++ {
// 		i = (i + 1) % 256
// 		j = (j + s[i]) % 256
// 		s[i], s[j] = s[j], s[i]
// 		result[k] = data[k] ^ byte(s[(s[i]+s[j])%256])
// 	}
// 	return string(result)
// }

func customBase64Encode(data string, base string) string {
	result := ""
	bytes := []byte(data)
	i := 0
	for i+3 <= len(bytes) {
		b := (int(bytes[i]) << 16) | (int(bytes[i+1]) << 8) | int(bytes[i+2])
		result += string(base[(b>>18)&0x3F])
		result += string(base[(b>>12)&0x3F])
		result += string(base[(b>>6)&0x3F])
		result += string(base[b&0x3F])
		i += 3
	}

	if i < len(bytes) {
		var b int
		b = int(bytes[i]) << 16
		if i+1 < len(bytes) {
			b |= int(bytes[i+1]) << 8
		}

		result += string(base[(b>>18)&0x3F])
		result += string(base[(b>>12)&0x3F])
		if i+1 < len(bytes) {
			result += string(base[(b>>6)&0x3F])
		} else {
			result += "="
		}
		result += "="
	}

	return result
}

// VM66
func urlEncodeParams(baseUrl string, params []string) string {
	if len(params)%2 != 0 {
		// Must be even: key1, value1, key2, value2, ...
		return baseUrl
	}

	parsedUrl, err := url.Parse(baseUrl)
	if err != nil {
		return baseUrl // return unchanged if URL is invalid
	}

	query := parsedUrl.Query()

	for i := 0; i < len(params); i += 2 {
		key := params[i]
		value := params[i+1]
		query.Add(key, value)
	}

	parsedUrl.RawQuery = query.Encode()
	return parsedUrl.String()
}

// VM67
func getQueryString(url string) string {
	return url[strings.Index(url, "?")+1:] // get query string
}

func VM108(arg0, arg1 int) []byte {
	buffer := make([]byte, 3)

	buffer[0] = byte(arg0 / 256)
	buffer[1] = byte(arg0 % 256)
	buffer[2] = byte(arg1 % 256)

	return buffer
}

func (s *Signer) Sign(url string, params []string, userAgent string) string {
	kb := &KB{}
	lb := strings.Split("0123456789abcdef", "")
	mb := make([]string, 256)
	nb := make([]int, 256) // or []byte if you only need 0-255

	url = urlEncodeParams(url, []string{"ms_token", MsToken})

	for i := 0; i < 256; i++ {
		mb[i] = lb[(i>>4)&15] + lb[i&15]
		if i < 16 {
			if i < 10 {
				nb[48+i] = i
			} else {
				nb[87+i] = i
			}
		}
	}
	kb.mb = mb
	kb.nb = nb
	hash1 := md5Hex(getQueryString(url))
	decode1 := kb.decode(hash1)
	hash2 := md5Hex(string(decode1))
	decode2 := kb.decode(hash2)

	initHashDecoded := kb.decode(hash2)
	fmt.Println("initHashDecoded: ", initHashDecoded)
	hashInitHashDecoded := md5Hex(string(initHashDecoded))
	fmt.Println("hashInitHashDecoded: ", hashInitHashDecoded)
	decodeHashInitHashDecoded := kb.decode(hashInitHashDecoded)
	fmt.Println("decodeHashInitHashDecoded: ", decodeHashInitHashDecoded)

	initEncryptionKey := VM108(1, 0)
	fmt.Println("initEncryptionKey: ", initEncryptionKey)
	userAgentBytes := []byte(userAgent)
	fmt.Println("userAgentBytes: ", userAgentBytes)

	encryptedUserAgent := rc4Encrypt(initEncryptionKey, userAgentBytes)
	fmt.Println("encryptedUserAgent: ", encryptedUserAgent)
	encodedEncryptedUserAgent := customBase64(encryptedUserAgent, "s0")
	fmt.Println("encodedEncryptedUserAgent: ", encodedEncryptedUserAgent)
	hashEncodedEncryptedUserAgent := md5Hex(encodedEncryptedUserAgent)
	fmt.Println("hashEncodedEncryptedUserAgent: ", hashEncodedEncryptedUserAgent)
	decodeHashEncodedEncryptedUserAgent := kb.decode(hashEncodedEncryptedUserAgent)
	fmt.Println("decodeHashEncodedEncryptedUserAgent: ", decodeHashEncodedEncryptedUserAgent)

	now := time.Now().Unix() / 1000
	fmt.Println("now: ", now)

	valuesArray := []int{
		64,
		0, // = 0 in Go, integer division
		1, // = 1
		0,
		int(decode2[14]),
		int(decode2[15]),
		int(decodeHashInitHashDecoded[14]),
		int(decodeHashInitHashDecoded[15]),
		int(decodeHashEncodedEncryptedUserAgent[14]),
		int(decodeHashEncodedEncryptedUserAgent[15]),
		int((now >> 24) & 0xFF),
		int((now >> 16) & 0xFF),
		int((now >> 8) & 0xFF),
		int(now & 0xFF),
		int((1508145731 >> 24) & 0xFF),
		int((1508145731 >> 16) & 0xFF),
		int((1508145731 >> 8) & 0xFF),
		int(1508145731 & 0xFF),
	}

	key := 0
	for _, v := range valuesArray {
		key ^= v
	}

	valuesArray2 := []int{
		valuesArray[0],
		valuesArray[2],
		valuesArray[4],
		valuesArray[6],
		valuesArray[8],
		valuesArray[10],
		valuesArray[12],
		valuesArray[14],
		valuesArray[16],
		key,
		valuesArray[1],
		valuesArray[3],
		valuesArray[5],
		valuesArray[7],
		valuesArray[9],
		valuesArray[11],
		valuesArray[13],
		valuesArray[15],
		valuesArray[17],
	}

	array2String := VM112(valuesArray2)

	strKey := VM109(255)

	ans := rc4EncryptString(strKey, array2String)

	fmt.Println("ans: ", ans)
	joinStr := VM110(2, 255, ans)
	fmt.Println("joinStr: ", joinStr)
	xBogus := customBase64([]byte(joinStr), "s2")
	fmt.Println("xBogus: ", xBogus)

	url = urlEncodeParams(url, []string{"X-Bogus", xBogus})
	fmt.Println(url)

	// Get current Unix time in seconds as uint32, then convert to string
	nowTime := strconv.FormatUint(uint64(uint32(time.Now().Unix())), 10)
	fmt.Println("nowTime: ", nowTime)
	encryptedNow := Ab41(0, nowTime)
	fmt.Println("encryptedNow: ", encryptedNow)
	urlNoProtocol := "www.tiktok.com/@/video/"
	encryptedProtocol := Ab41(encryptedNow, urlNoProtocol) % 65521

	// 'now' as uint32 (should be the same as used in Ab41)
	nowInt32 := uint64(time.Now().Unix())

	// Calculate encoded as a binary string (32 bits, unsigned)
	encodedInt := ((encryptedProtocol * 65521) ^ nowInt32) & 0xFFFFFFFF
	encoded := strconv.FormatUint(uint64(encodedInt), 2)

	// Clamp: "10000000110000" + rightmost 32 bits of encoded, padded to 32
	prefix := "10000000110000"
	if len(encoded) < 32 {
		encoded = strings.Repeat("0", 32-len(encoded)) + encoded
	}
	encodedClamped := prefix + encoded[len(encoded)-32:]
	intEncodedClamped, _ := strconv.ParseUint(encodedClamped, 2, 64)

	// Final encrypted
	encryptedIntEncodedClamped := Ab41(0, strconv.FormatUint(intEncodedClamped, 10))

	fmt.Println("urlNoProtocol:", urlNoProtocol)
	fmt.Println("encryptedProtocol:", encryptedProtocol)
	fmt.Println("encoded:", encoded)
	fmt.Println("encodedClamped:", encodedClamped)
	fmt.Println("intEncodedClamped:", intEncodedClamped)
	fmt.Println("encryptedIntEncodedClamped:", encryptedIntEncodedClamped)

	newUrl := serializeParams(parseQeryParams(url)) + "pathname=" + pathWithoutQuery(url) + "&tt_webid=&uuid="

	constant := uint64(1508145731)

	fmt.Println("newUrl: ", newUrl)
	fmt.Println("constant: ", constant)

	// a, b, c, d
	a := VM192(intEncodedClamped)
	b := intEncodedClamped / 4294967296
	c := VM191((intEncodedClamped << 28) | (b >> 4))
	d := a + c

	// e, encrypted
	e := constant ^ intEncodedClamped
	encrypted := ((Ab41(encryptedIntEncodedClamped, userAgent) % 65521) << 16) |
		(Ab41(encryptedIntEncodedClamped, newUrl) % 65521)

	feVersion := 2
	f := (1 << 8) | (feVersion << 4) // 1 is from environment checker

	inititalSignature := "_02B4Z6wo00001" +
		d +
		VM194(e, b) +
		VM192(encrypted) +
		VM193(uint64(f)^intEncodedClamped, encrypted) +
		VM191(encryptedProtocol)

	// Checksum
	signCheckSum := fmt.Sprintf("%x", checkSum(0, inititalSignature))
	last2 := ""
	if len(signCheckSum) >= 2 {
		last2 = signCheckSum[len(signCheckSum)-2:]
	} else {
		last2 = signCheckSum
	}
	signature := inititalSignature + last2

	url = urlEncodeParams(url, []string{"_signature", signature})
	fmt.Println("url: ", url)
	return url
}

func VM190(arg0 int) string {
	value := arg0 & 63
	var charCode int
	switch {
	case value < 26:
		charCode = 65
	case value < 52:
		charCode = 71
	case value < 62:
		charCode = -4
	default:
		charCode = -17
	}
	return string(rune(charCode + value))
}

func VM191(i uint64) string {
	return VM190(int(i>>24)) +
		VM190(int(i>>18)) +
		VM190(int(i>>12)) +
		VM190(int(i>>6)) +
		VM190(int(i))
}

func VM193(i, encrypted uint64) string {
	return VM191((encrypted << 28) | (i >> 4))
}

func VM192(i uint64) string {
	return VM191(i >> 2)
}

func VM194(i, encrypted uint64) string {
	return VM191((encrypted<<26)|(i>>6)) + VM190(int(i))
}

// AB7
func pathWithoutQuery(rawurl string) string {
	if rawurl == "" {
		return "/"
	}
	i := strings.Index(rawurl, "?")
	if i >= 0 {
		return rawurl[:i]
	}
	return rawurl
}

// AB49
func serializeParams(params map[string]string) string {
	if len(params) == 0 {
		return ""
	}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(params[k])
		sb.WriteString("&")
	}
	return sb.String()
}

// AB72
func parseQeryParams(rawurl string) map[string]string {
	params := make(map[string]string)
	if rawurl == "" {
		return params
	}
	u, err := url.Parse(rawurl)
	if err != nil {
		return params
	}
	for key, values := range u.Query() {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	return params
}

func VM95() string {
	return "application/x-www-form-urlencoded"
}

func VM94(applicationType string) bool {
	return applicationType == "application/x-www-form-urlencoded" || applicationType == "application/json"
}

// checkSum computes the checksum like the JS version, working on UTF-16 code units.
func checkSum(checkSum uint32, str string) uint32 {
	// Convert the string to a slice of UTF-16 code units
	utf16s := utf16.Encode([]rune(str))
	for i := 0; i < len(utf16s); i++ {
		charCode := uint32(utf16s[i])
		// No need for surrogate pair handling, utf16.Encode already does this
		checkSum = (65599*checkSum + charCode) & 0xFFFFFFFF
	}
	return checkSum
}

func Ab41(e uint64, t string) uint64 {
	utf16s := utf16.Encode([]rune(t))
	for _, charCode := range utf16s {
		e = 65599 * (e ^ uint64(charCode)) & 0xFFFFFFFF
	}
	return e
}

func rc4EncryptString(key, data string) string {
	c, err := rc4.NewCipher([]byte(key))
	if err != nil {
		log.Fatal(err)
	}
	dst := make([]byte, len(data))
	c.XORKeyStream(dst, []byte(data))
	fmt.Println("rc4EncryptString: ", string(dst))
	return string(dst)
}

func VM109(arg0 int) string {
	return string(arg0)
}

func VM110(arg0, arg1 int, arg2 string) string {
	return VM109(arg0) + VM109(arg1) + arg2
}

func VM112(array []int) string {
	buffer := make([]byte, 19)

	buffer[0] = byte(array[0])
	buffer[1] = byte(array[10])
	buffer[2] = byte(array[1])
	buffer[3] = byte(array[11])
	buffer[4] = byte(array[2])
	buffer[5] = byte(array[12])
	buffer[6] = byte(array[3])
	buffer[7] = byte(array[13])
	buffer[8] = byte(array[4])
	buffer[9] = byte(array[14])
	buffer[10] = byte(array[5])
	buffer[11] = byte(array[15])
	buffer[12] = byte(array[6])
	buffer[13] = byte(array[16])
	buffer[14] = byte(array[7])
	buffer[15] = byte(array[17])
	buffer[16] = byte(array[8])
	buffer[17] = byte(array[18])
	buffer[18] = byte(array[9])

	return string(buffer)
}

func customBase64(text []byte, baseIndex string) string {
	bases := map[string]string{
		"s0": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
		"s1": "Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
		"s2": "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
	}
	base := bases[baseIndex]

	//def b64_encode(
	//     # they thought they could trick us with this shifty
	//     string,
	//     key_table="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	// ):
	//     last_list = list()
	//     for i in range(0, len(string), 3):
	//         try:
	//             num_1 = ord(string[i])
	//             num_2 = ord(string[i + 1])
	//             num_3 = ord(string[i + 2])
	//             arr_1 = num_1 >> 2
	//             arr_2 = (3 & num_1) << 4 | (num_2 >> 4)
	//             arr_3 = ((15 & num_2) << 2) | (num_3 >> 6)
	//             arr_4 = 63 & num_3

	//         except IndexError:
	//             arr_1 = num_1 >> 2
	//             arr_2 = ((3 & num_1) << 4) | 0
	//             arr_3 = 64
	//             arr_4 = 64

	//         last_list.append(arr_1)
	//         last_list.append(arr_2)
	//         last_list.append(arr_3)
	//         last_list.append(arr_4)

	//     return "".join([key_table[value] for value in last_list])

	result := ""
	i := 0
	for i+3 <= len(text) {
		char1 := int(text[i]) & 0xFF
		char2 := int(text[i+1]) & 0xFF
		char3 := int(text[i+2]) & 0xFF
		i += 3

		triplet := (char1 << 16) | (char2 << 8) | char3

		result += string(base[(triplet>>18)&0x3F])
		result += string(base[(triplet>>12)&0x3F])
		result += string(base[(triplet>>6)&0x3F])
		result += string(base[triplet&0x3F])
	}

	if i < len(text) {
		char1 := int(text[i]) & 0xFF
		i++
		var char2 int
		if i < len(text) {
			char2 = int(text[i]) & 0xFF
			i++
		} else {
			char2 = 0
		}
		remaining := (char1 << 16) | (char2 << 8)

		result += string(base[(remaining>>18)&0x3F])
		result += string(base[(remaining>>12)&0x3F])

		if i < len(text) {
			result += string(base[(remaining>>6)&0x3F])
		} else {
			result += "="
		}
		result += "="
	}

	return result
}

type KB struct {
	mb []string
	nb []int
}

func (kb *KB) encode(e string) string {
	t := len(e)
	r := ""
	n := 0
	for n < t {
		r += kb.mb[e[n]]
		n++
	}
	return r
}

func (kb *KB) decode(e string) []byte {
	t := len(e) >> 1
	r := t << 1
	n := make([]byte, t)
	o := 0
	a := 0
	for a < r {
		n[o] = byte(kb.nb[e[a]]<<4 | kb.nb[e[a+1]])
		a += 2
		o++
	}
	return n
}
