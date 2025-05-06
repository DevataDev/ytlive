package sign

import (
	"crypto/md5"
	"fmt"
	"strings"
	"time"
)

type XBogus struct {
	Array         [128]*int
	Character     string
	UaKey         []byte
	UserAgent     string
	XB            string
	Params        string
	TiktokEncoder *TiktokEncoder
}

var (
	Bases = map[string]string{
		"s0": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
		"s1": "Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
		"s2": "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
	}
)

const (
	InitBogusHash = "d41d8cd98f00b204e9800998ecf8427e"
)

func GetBase(base string) string {
	return Bases[base]
}

func generateEncryptionKey(arg0 int, arg1 int) []byte {
	buffer := make([]byte, 3)

	buffer[0] = byte(arg0 / 256)
	buffer[1] = byte(arg0 % 256)
	buffer[2] = byte(arg1 % 256)

	return buffer
}

func NewXBogus(userAgent string) *XBogus {
	var arr [128]*int
	for i := 48; i <= 57; i++ {
		val := i - 48
		arr[i] = &val
	}
	for i := 65; i <= 70; i++ {
		val := i - 55
		arr[i] = &val
	}
	for i := 97; i <= 102; i++ {
		val := i - 87
		arr[i] = &val
	}

	if userAgent == "" {
		userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
	}

	fmt.Println("userAgent", userAgent)
	initEncryptionKey := generateEncryptionKey(1, 0)
	fmt.Println("initEncryptionKey", string(initEncryptionKey))

	return &XBogus{
		Array:         arr,
		Character:     GetBase("s2"),
		UaKey:         initEncryptionKey,
		UserAgent:     userAgent,
		TiktokEncoder: NewTiktokEncoder(),
	}
}

func (xb *XBogus) md5StrToArray(md5Str string) []byte {
	if len(md5Str) > 32 {
		return []byte(md5Str)
	}
	array := []byte{}
	for i := 0; i < len(md5Str); i += 2 {
		hi := xb.Array[md5Str[i]]
		lo := xb.Array[md5Str[i+1]]
		array = append(array, byte((*hi<<4)|*lo))
	}
	return array
}

func (xb *XBogus) md5Encrypt(urlPath string) []byte {
	return xb.md5StrToArray(xb.md5(xb.md5StrToArray(xb.md5(urlPath))))
}

func (xb *XBogus) md5(input interface{}) string {
	var data []byte
	switch v := input.(type) {
	case string:
		data = xb.md5StrToArray(v)
	case []byte:
		data = v
	default:
		panic("Invalid input to md5")
	}
	hash := md5.Sum(data)
	return fmt.Sprintf("%x", hash)
}

func (xb *XBogus) converIntToString(arg0 int) string {
	return string(rune(arg0))
}

func (xb *XBogus) mergeIntAndStringg(arg0 int, arg1 int, arg3 string) string {
	return xb.converIntToString(arg0) + xb.converIntToString(arg1) + arg3
}

func (xb *XBogus) encodingConversion(data []byte) string {
	return string(data)
}

func (xb *XBogus) encodingConversion2(a, b byte, c string) string {
	return string([]byte{a, b}) + c
}

func rc4Encrypt(key, data []byte) []byte {
	S := make([]byte, 256)
	for i := range S {
		S[i] = byte(i)
	}
	j := 0
	for i := range S {
		j = (j + int(S[i]) + int(key[i%len(key)])) % 256
		S[i], S[j] = S[j], S[i]
	}
	i := 0
	j = 0
	var result []byte
	for _, b := range data {
		i = (i + 1) % 256
		j = (j + int(S[i])) % 256
		S[i], S[j] = S[j], S[i]
		k := S[(int(S[i])+int(S[j]))%256]
		result = append(result, b^k)
	}
	return result
}

func (xb *XBogus) calculation(a, b, c byte) string {
	x := (int(a)&255)<<16 | (int(b)&255)<<8 | int(c)
	return string(xb.Character[(x&16515072)>>18]) +
		string(xb.Character[(x&258048)>>12]) +
		string(xb.Character[(x&4032)>>6]) +
		string(xb.Character[x&63])
}

func (xb *XBogus) b64Encode(text []byte, baseIndex string) string {
	base := GetBase(baseIndex)
	result := ""
	i := 0
	textLen := len(text)

	for i+3 <= textLen {
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

	if i < textLen {
		char1 := int(text[i]) & 0xFF
		i++
		var char2 int
		if i < textLen {
			char2 = int(text[i]) & 0xFF
			i++
		} else {
			char2 = 0
		}
		remaining := (char1 << 16) | (char2 << 8)

		result += string(base[(remaining>>18)&0x3F])
		result += string(base[(remaining>>12)&0x3F])

		if i < textLen {
			result += string(base[(remaining>>6)&0x3F])
		} else {
			result += "="
		}
		result += "="
	}

	return result
}

func (xb *XBogus) getQueryString(url string) string {
	return url[strings.Index(url, "?")+1:] // get query string
}

func (xb *XBogus) intArrayToByteArray(array []int) []byte {
	if len(array) < 19 {
		return []byte{}
	}
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
	return buffer
}

func (xb *XBogus) GetXBogus(urlPath string) (string, string, string) {
	query := xb.getQueryString(urlPath)
	hash1 := xb.md5(query)
	decode1 := xb.TiktokEncoder.Decode(hash1)
	hash2 := xb.md5(decode1)
	decode2 := xb.TiktokEncoder.Decode(hash2) // executionStack[12]

	initHashDecoded := xb.TiktokEncoder.Decode(InitBogusHash)
	hashInitHashDecoded := xb.md5(initHashDecoded)
	decodeHashInitHashDecoded := xb.TiktokEncoder.Decode(hashInitHashDecoded)

	encryptedUserAgent := rc4Encrypt(xb.UaKey, []byte(xb.UserAgent))
	encodedEncryptedUserAgent := xb.b64Encode(encryptedUserAgent, "s0")
	hashEncodedEncryptedUserAgent := xb.md5(encodedEncryptedUserAgent)
	decodeHashEncodedEncryptedUserAgent := xb.TiktokEncoder.Decode(hashEncodedEncryptedUserAgent)

	timer := int(time.Now().Unix())
	ct := 1508145731

	fmt.Println("timer", timer)
	fmt.Println("ct", ct)

	newArray := []int{
		64,
		0, // 1/256 as int is 0; if you need the float, handle separately!
		1 % 256,
		0,
		int(decode2[14]),
		int(decode2[15]),
		int(decodeHashInitHashDecoded[14]),
		int(decodeHashInitHashDecoded[15]),
		int(decodeHashEncodedEncryptedUserAgent[14]),
		int(decodeHashEncodedEncryptedUserAgent[15]),
		(timer >> 24) & 0xFF,
		(timer >> 16) & 0xFF,
		(timer >> 8) & 0xFF,
		timer & 0xFF,
		(ct >> 24) & 0xFF,
		(ct >> 16) & 0xFF,
		(ct >> 8) & 0xFF,
		ct & 0xFF,
	}

	key := newArray[0]
	for _, val := range newArray[1:] {
		key ^= val
	}

	valuesArray2 := []int{
		newArray[0],
		newArray[2],
		newArray[4],
		newArray[6],
		newArray[8],
		newArray[10],
		newArray[12],
		newArray[14],
		newArray[16],
		key,
		newArray[1],
		newArray[3],
		newArray[5],
		newArray[7],
		newArray[9],
		newArray[11],
		newArray[13],
		newArray[15],
		newArray[17],
	}

	rc4Key := []byte{255}
	converted := xb.intArrayToByteArray(valuesArray2)
	rc4Data := rc4Encrypt(rc4Key, converted)
	garbled := xb.encodingConversion2(2, 255, string(rc4Data))

	var xbStr strings.Builder
	for i := 0; i < len(garbled); i += 3 {
		xbStr.WriteString(xb.calculation(garbled[i], garbled[i+1], garbled[i+2]))
	}

	xb.XB = xbStr.String()
	xb.Params = urlPath + "&X-Bogus=" + xb.XB
	return xb.Params, xb.XB, xb.UserAgent
}

func (xb *XBogus) sortQueryParams(baseUrl string, params []string) string {
	var queryString string
	var paramString string

	for i := 0; i < len(params); i++ {
		if i%2 == 0 {
			paramString = params[i]
		} else {
			queryString += "&" + paramString + "=" + params[i]
		}
	}

	resultUrl := baseUrl

	if len(queryString) > 1 {
		queryString = queryString[1:]

		hasExistingQuery := strings.Contains(baseUrl, "?")
		separator := "?"
		if hasExistingQuery {
			separator = "&"
		}

		resultUrl += separator + queryString
	}

	return resultUrl
}
