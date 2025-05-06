package sign

import (
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type SignatureManager struct {
}

const (
	InitSignature = "_02B4Z6wo00001"
	Magic         = 1508145731
	FeVersion     = 2
)

func NewSignatureManager() *SignatureManager {
	return &SignatureManager{}
}

// Ab41 replicates the custom hash function from JS
func (sm *SignatureManager) Ab41(e uint32, t string) uint32 {
	for i := 0; i < len(t); i++ {
		e = 65599 * (e ^ uint32(t[i]))
		e = e & 0xFFFFFFFF // mimic JS uint32 overflow
	}
	return e
}

func (sm *SignatureManager) ExtractQueryParameter(rawUrl string) map[string]string {
	// Ab72 extracts query parameters from the given URL and returns them as a map[string]string
	params := make(map[string]string)
	if rawUrl == "" {
		return params
	}
	// Find the query string part
	idx := strings.Index(rawUrl, "?")
	if idx == -1 || idx == len(rawUrl)-1 {
		return params
	}
	queryString := rawUrl[idx+1:]
	// Split into key=value pairs
	pairs := strings.Split(queryString, "&")
	for _, pair := range pairs {
		if pair == "" {
			continue
		}
		kv := strings.SplitN(pair, "=", 2)
		key := kv[0]
		value := ""
		if len(kv) > 1 {
			value, _ = url.QueryUnescape(kv[1])
		}
		if key != "" {
			params[key] = value
		}
	}
	return params
}

// Ab49 formats and sorts the params map as a query string (key1=value1&key2=value2&)
func (sm *SignatureManager) SortsQueryParams(params map[string]string) string {
	if params == nil || (params != nil && len(params) == 0) {
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

// Ab7 returns the base URL (without query parameters)
func (sm *SignatureManager) BaseUrl(rawUrl string) string {
	if rawUrl == "" {
		return "/"
	}
	qIdx := strings.Index(rawUrl, "?")
	if qIdx != -1 {
		if qIdx == 0 {
			return "/"
		}
		return rawUrl[:qIdx]
	}
	return rawUrl
}

// VM190 returns a character based on the bitwise transformation logic from JS
func (sm *SignatureManager) BitwiseTransformation(arg0 int) string {
	value := arg0 & 63
	var charCode int
	if value < 26 {
		charCode = 65
	} else if value < 52 {
		charCode = 71
	} else if value < 62 {
		charCode = -4
	} else {
		charCode = -17
	}
	return string(rune(charCode + value))
}

// VM191 encodes an integer into a 5-character string using VM190
func (sm *SignatureManager) EncodeInteger(i int) string {
	return sm.BitwiseTransformation(i>>24) +
		sm.BitwiseTransformation(i>>18) +
		sm.BitwiseTransformation(i>>12) +
		sm.BitwiseTransformation(i>>6) +
		sm.BitwiseTransformation(i)
}

// VM192 encodes an integer shifted right by 2
func (sm *SignatureManager) ShiftRight(i int) string {
	return sm.EncodeInteger(i >> 2)
}

// VM193 encodes an integer with an encrypted value, left shift 28, or right shift 4
func (sm *SignatureManager) EncodeWithShift(i, encrypted int) string {
	return sm.EncodeInteger((encrypted << 28) | (i >> 4))
}

// VM194 encodes an integer with an encrypted value, left shift 26, or right shift 6, then adds VM190(i)
func (sm *SignatureManager) EncodeWithShiftAndAdd(i, encrypted int) string {
	return sm.EncodeInteger((encrypted<<26)|(i>>6)) + sm.BitwiseTransformation(i)
}

// CheckSum computes a custom hash over a string, handling surrogate pairs like the JS version
func (sm *SignatureManager) CheckSum(checkSum uint32, str string) uint32 {
	for i := 0; i < len(str); {
		r := rune(str[i])
		var charCode uint32
		// Check for surrogate pair
		if r >= 0xD800 && r <= 0xDBFF && i+1 < len(str) {
			nextR := rune(str[i+1])
			if nextR >= 0xDC00 && nextR <= 0xDFFF {
				charCode = ((uint32(r)&0x3FF)<<10 | (uint32(nextR) & 0x3FF)) + 0x10000
				i += 2
				checkSum = (65599*checkSum + charCode) & 0xFFFFFFFF
				continue
			}
		}
		charCode = uint32(r)
		checkSum = (65599*checkSum + charCode) & 0xFFFFFFFF
		i++
	}
	return checkSum
}

func (sm *SignatureManager) GenerateSignature(url string, userAgent string) string {
	// Step 1: Get current unix timestamp (seconds)
	now := uint32(time.Now().Unix())
	nowStr := strconv.FormatUint(uint64(now), 10)

	// Step 2: Ab41(0, now as string)
	encryptedNow := sm.Ab41(0, nowStr)

	// Step 3: urlNoProtocol (hardcoded as in JS)
	urlNoProtocol := "www.tiktok.com/@/video/"

	// Step 4: Ab41(encryptedNow, urlNoProtocol) % 65521
	encryptedProtocol := sm.Ab41(encryptedNow, urlNoProtocol) % 65521

	// Step 5: (((encryptedProtocol * 65521) ^ now) >>> 0).toString(2)
	encoded := (encryptedProtocol * 65521) ^ now
	encoded &= 0xFFFFFFFF // JS >>> 0
	encodedBin := strconv.FormatUint(uint64(encoded), 2)

	// Step 6: encodedClamped
	prefix := "10000000110000"
	encodedLen := len(encodedBin)
	var last32 string
	if encodedLen >= 32 {
		last32 = encodedBin[encodedLen-32:]
	} else {
		last32 = encodedBin
	}
	// padEnd(32, "0")
	if len(last32) < 32 {
		last32 += string(make([]byte, 32-len(last32)))
		for i := encodedLen; i < 32; i++ {
			last32 += "0"
		}
	}
	encodedClamped := prefix + last32

	// Step 7: parseInt(encodedClamped, 2)
	intEncodedClamped, _ := strconv.ParseUint(encodedClamped, 2, 64)

	// Step 8: Ab41(0, intEncodedClamped as string)
	encryptedIntEncodedClamped := sm.Ab41(0, strconv.FormatUint(intEncodedClamped, 10))

	fmt.Println("encryptedIntEncodedClamped", encryptedIntEncodedClamped)

	newUrl := sm.SortsQueryParams(sm.ExtractQueryParameter(url)) + "pathname=" + sm.BaseUrl(url) + "&tt_webid=&uuid="

	fmt.Println("newUrl", newUrl)

	a := sm.ShiftRight(int(intEncodedClamped))
	b := (intEncodedClamped / 4294967296) >> 0
	c := sm.EncodeWithShift(int(intEncodedClamped<<28), int(b>>4))
	d := a + c

	e := (Magic ^ intEncodedClamped)

	f := (1 << 8) | (FeVersion << 4)

	encrypted := (sm.Ab41(encryptedIntEncodedClamped, userAgent)%65521)<<16 |
		sm.Ab41(encryptedIntEncodedClamped, newUrl)%65521

	signature := InitSignature +
		d +
		sm.EncodeWithShiftAndAdd(int(e), int(b)) +
		sm.ShiftRight(int(encrypted)) +
		sm.EncodeWithShift(int(f^int(intEncodedClamped)), int(encrypted)) +
		sm.EncodeInteger(int(encryptedProtocol))

	signCheckSum := sm.CheckSum(0, signature)
	hexCheckSum := fmt.Sprintf("%x", signCheckSum)
	// Get the last two characters (handle if hexCheckSum is less than 2 chars)
	lastTwo := ""
	if len(hexCheckSum) >= 2 {
		lastTwo = hexCheckSum[len(hexCheckSum)-2:]
	} else {
		lastTwo = fmt.Sprintf("%02s", hexCheckSum)
	}
	finalSignature := signature + lastTwo

	return finalSignature
}
