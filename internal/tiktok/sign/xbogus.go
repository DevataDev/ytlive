package sign

import (
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"strings"
	"time"
)

type XBogus struct {
	Array     [128]*int
	Character string
	UaKey     []byte
	UserAgent string
	XB        string
	Params    string
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

	return &XBogus{
		Array:     arr,
		Character: "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
		UaKey:     []byte{0x00, 0x01, 0x0c},
		UserAgent: userAgent,
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

func (xb *XBogus) GetXBogus(urlPath string) (string, string, string) {
	array1 := xb.md5StrToArray(xb.md5(
		base64.StdEncoding.EncodeToString(
			rc4Encrypt(xb.UaKey, []byte(xb.UserAgent)),
		),
	))

	array2 := xb.md5StrToArray(xb.md5(xb.md5StrToArray("d41d8cd98f00b204e9800998ecf8427e")))
	urlPathArray := xb.md5Encrypt(urlPath)

	timer := int(time.Now().Unix())
	ct := 536919696

	newArray := []int{
		64, 1, 1, 12,
		int(urlPathArray[14]), int(urlPathArray[15]),
		int(array2[14]), int(array2[15]),
		int(array1[14]), int(array1[15]),
		timer >> 24 & 255, timer >> 16 & 255, timer >> 8 & 255, timer & 255,
		ct >> 24 & 255, ct >> 16 & 255, ct >> 8 & 255, ct & 255,
	}

	xor := newArray[0]
	for _, val := range newArray[1:] {
		xor ^= val
	}
	newArray = append(newArray, xor)

	var array3, array4 []byte
	for i := 0; i < len(newArray); i += 2 {
		array3 = append(array3, byte(newArray[i]))
		if i+1 < len(newArray) {
			array4 = append(array4, byte(newArray[i+1]))
		}
	}
	merged := append(array3, array4...)

	rc4Key := []byte{255}
	converted := xb.encodingConversion(merged)
	rc4Data := rc4Encrypt(rc4Key, []byte(converted))
	garbled := xb.encodingConversion2(2, 255, string(rc4Data))

	var xbStr strings.Builder
	for i := 0; i < len(garbled); i += 3 {
		xbStr.WriteString(xb.calculation(garbled[i], garbled[i+1], garbled[i+2]))
	}

	xb.XB = xbStr.String()
	xb.Params = urlPath + "&X-Bogus=" + xb.XB
	return xb.Params, xb.XB, xb.UserAgent
}
