package sign

import "strings"

type TiktokEncoder struct {
	lb []string
	mb []string
	nb []int
}

func NewTiktokEncoder() *TiktokEncoder {
	lb := strings.Split("0123456789abcdef", "")
	mb := make([]string, 256)
	nb := make([]int, 256)

	for i := 0; i < 256; i++ {
		mb[i] = lb[i>>4&15] + lb[15&i]
		if i < 16 {
			if i < 10 {
				nb[48+i] = i
			} else {
				nb[87+i] = i
			}
		}
	}
	return &TiktokEncoder{
		lb: lb,
		mb: mb,
		nb: nb,
	}
}

func (kb *TiktokEncoder) Encode(e []byte) string {
	var r string
	for n := 0; n < len(e); {
		r += kb.mb[e[n]]
		n++
	}
	return r
}

func (kb *TiktokEncoder) Decode(e string) []byte {
	t := len(e) >> 1
	r := t << 1
	n := make([]byte, t)
	o := 0
	a := 0
	for a < r {
		high := kb.nb[e[a]]
		a++
		low := kb.nb[e[a]]
		a++
		n[o] = byte((high << 4) | low)
		o++
	}
	return n
}
