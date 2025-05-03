package tiktok

import (
	"errors"
	"math/rand"
	"strings"
)

type LocationPreset struct {
	Lang        string
	LangCountry string
	Country     string
	TZName      string
}

var LocationPresets = map[string]LocationPreset{
	"ID": {
		Lang:        "id",
		LangCountry: "id-ID",
		Country:     "ID",
		TZName:      "Asia/Jakarta",
	},

	"SG": {
		Lang:        "sg",
		LangCountry: "sg-SG",
		Country:     "SG",
		TZName:      "Asia/Singapore",
	},

	"MY": {
		Lang:        "my",
		LangCountry: "my-MY",
		Country:     "MY",
		TZName:      "Asia/Kuala_Lumpur",
	},
}

func GetLocationPreset(location string) (LocationPreset, error) {
	if location == "" {
		return LocationPreset{}, errors.New("location is empty")
	}

	location = strings.ToUpper(location)

	if _, ok := LocationPresets[location]; !ok {
		return LocationPreset{}, errors.New("location not found")
	}

	return LocationPresets[location], nil
}

type DevicePreset struct {
	BrowserVersion  string
	BrowserName     string
	BrowserPlatform string
	UserAgent       string
	OS              string
}

type ScreenPreset struct {
	ScreenWidth  int
	ScreenHeight int
}

func UserAgentToDevicePreset(userAgent string) (DevicePreset, error) {
	if userAgent == "" {
		return DevicePreset{}, errors.New("user agent is empty")
	}

	firstSlash := strings.Index(userAgent, "/")
	if firstSlash == -1 {
		return DevicePreset{}, errors.New("user agent is invalid")
	}

	browserName := userAgent[:firstSlash]
	browserVersion := userAgent[firstSlash+1:]

	var browserPlatform string
	if strings.Contains(userAgent, "Macintosh") {
		browserPlatform = "MacIntel"
	} else {
		browserPlatform = "Win32"
	}

	var os string
	if strings.Contains(userAgent, "Macintosh") {
		os = "mac"
	} else {
		os = "windows"
	}

	return DevicePreset{
		BrowserVersion:  browserVersion,
		BrowserName:     browserName,
		BrowserPlatform: browserPlatform,
		UserAgent:       userAgent,
		OS:              os,
	}, nil
}

var ScreenPresets = []ScreenPreset{
	{
		ScreenWidth:  1920,
		ScreenHeight: 1080,
	},
	{
		ScreenWidth:  2560,
		ScreenHeight: 1440,
	},
	{
		ScreenWidth:  3840,
		ScreenHeight: 2160,
	},
	{
		ScreenWidth:  4096,
		ScreenHeight: 2160,
	},
	{
		ScreenWidth:  5120,
		ScreenHeight: 2880,
	},
	{
		ScreenWidth:  7680,
		ScreenHeight: 4320,
	},
	{
		ScreenWidth:  1152,
		ScreenHeight: 2048,
	},
	{
		ScreenWidth:  1440,
		ScreenHeight: 2560,
	},
	{
		ScreenWidth:  2160,
		ScreenHeight: 3840,
	},
	{
		ScreenWidth:  4320,
		ScreenHeight: 7680,
	},
}

var DevicePresets = make([]DevicePreset, 0)

func InitDevicePresets() {
	preset, error := UserAgentToDevicePreset("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
	if error != nil {
		return
	}
	DevicePresets = append(DevicePresets, preset)

	preset, error = UserAgentToDevicePreset("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
	if error != nil {
		return
	}
	DevicePresets = append(DevicePresets, preset)
}

func GetRandomDevicePreset() DevicePreset {
	return DevicePresets[rand.Intn(len(DevicePresets))]
}

func GetRandomScreenPreset() ScreenPreset {
	return ScreenPresets[rand.Intn(len(ScreenPresets))]
}
