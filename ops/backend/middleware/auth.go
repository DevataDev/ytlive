package middleware

import (
    "net/http"
    "strings"

    "github.com/devatadev/ytlive/ops/backend/auth"
    "github.com/gin-gonic/gin"
)

// RequireAuth checks Authorization: Bearer <token> header and injects uid/role into context.
func RequireAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := ""
        h := c.GetHeader("Authorization")
        if strings.HasPrefix(h, "Bearer ") {
            token = strings.TrimPrefix(h, "Bearer ")
        } else if cookie, err := c.Cookie("ops_jwt"); err == nil {
            token = cookie
        }
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
            return
        }
        claims, err := auth.Parse(token)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
            return
        }
        c.Set("uid", claims.UserID)
        c.Set("role", claims.Role)
        c.Next()
    }
}
