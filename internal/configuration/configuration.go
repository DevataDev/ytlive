package configuration

// Config struct for MySQL and default
type Config struct {
	App struct {
		Port int    `yaml:"port"`
		Host string `yaml:"host"`
		Mode string `yaml:"mode"`
		Sql  string `yaml:"sql"`
	} `yaml:"app"`
	MySQL struct {
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DBName   string `yaml:"dbname"`
		Params   string `yaml:"params"`
	} `yaml:"mysql"`
	Sqlite struct {
		Db string `yaml:"db"`
	} `yaml:"sqlite"`
	Default struct {
		Password string `yaml:"password"`
	} `yaml:"default"`

	Google struct {
		ApiKey string `yaml:"apiKey"`
	} `yaml:"google"`
	TikTok struct {
		UserAgent string  `yaml:"userAgent"`
		Cookie    string  `yaml:"cookie"`
		Proxy     Proxy   `yaml:"proxy"`
		MsToken   MsToken `yaml:"msToken"`
		OdinTT    OdinTT  `yaml:"odin_tt"`
		Ttwid     Ttwid   `yaml:"ttwid"`
	} `yaml:"tiktok"`
	Youtube Youtube `yaml:youtube`
}

type Proxy struct {
	Url string `yaml:"url"`
}

type MsToken struct {
	Url       string `yaml:"url"`
	Cookie    string `yaml:"cookie"`
	Magic     int    `yaml:"magic"`
	Version   int    `yaml:"version"`
	DataType  int    `yaml:"dataType"`
	StrData   string `yaml:"strData"`
	UserAgent string `yaml:"userAgent"`
}

type OdinTT struct {
	Url string `yaml:"url"`
}

type Ttwid struct {
	Url    string `yaml:"url"`
	Cookie string `yaml:"cookie"`
	Data   string `yaml:"data"`
}

type Youtube struct {
	RedirectURL  string `yaml:"redirectUrl"`
	ClientId     string `yaml:"clientId"`
	ClientSecret string `yaml:"clientSecret"`
}
