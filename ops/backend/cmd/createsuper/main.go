package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/spf13/pflag"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/devatadev/ytlive/ops/backend/models"
)

func main() {
	_ = godotenv.Load()
	email := pflag.StringP("email", "e", "", "email address of superuser")
	password := pflag.StringP("password", "p", "", "password (leave empty to prompt)")
	pflag.Parse()

	if *email == "" {
		log.Fatal("--email is required")
	}

	if *password == "" {
		fmt.Print("Enter password: ")
		reader := bufio.NewReader(os.Stdin)
		pwd, _ := reader.ReadString('\n')
		*password = strings.TrimSpace(pwd)
	}

	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		log.Fatal("POSTGRES_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	_ = db.AutoMigrate(&models.User{})

	u := models.User{Email: *email, Role: "superadmin"}
	if err := u.SetPassword(*password); err != nil {
		log.Fatal(err)
	}
	if err := db.Create(&u).Error; err != nil {
		log.Fatal(err)
	}

	fmt.Println("Superuser created with ID", u.ID)
}
