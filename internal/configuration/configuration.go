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
		UserAgent string `yaml:"userAgent"`
		Cookie    string `yaml:"cookie"`
	} `yaml:"tiktok"`
}
