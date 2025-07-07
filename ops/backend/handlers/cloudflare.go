package handlers

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "github.com/devatadev/ytlive/ops/backend/models"
)

// CloudflareHandler offers minimal endpoints to list zones and create DNS records.
// It fetches CF_TOKEN and CF_ACCOUNT_ID from the encrypted secrets table on each request.
// No CF_ZONE_ID is stored; zone IDs are discovered dynamically.
//
// Route table (protected group):
//   GET  /cloudflare/zones           -> ListZones()
//   POST /cloudflare/zones/:id/dns   -> CreateDNS()
//
// All requests require role admin or above (adjust as needed).

type CloudflareHandler struct {
    DB            *gorm.DB
    EncryptionKey string
}

func NewCloudflareHandler(db *gorm.DB, key string) *CloudflareHandler {
    return &CloudflareHandler{DB: db, EncryptionKey: key}
}

// ------- helpers -------

func (h *CloudflareHandler) fetchSecret(key string) (string, error) {
    var sec models.Secret
    if err := h.DB.First(&sec, "key = ?", key).Error; err != nil {
        return "", err
    }
    return sec.Get(h.EncryptionKey)
}

func (h *CloudflareHandler) cfRequest(method, url, token string, body io.Reader) (*http.Response, error) {
    req, err := http.NewRequest(method, url, body)
    if err != nil {
        return nil, err
    }
    req.Header.Set("Authorization", "Bearer "+token)
    req.Header.Set("Content-Type", "application/json")
    client := &http.Client{Timeout: 15 * time.Second}
    return client.Do(req)
}

// -------- Handlers --------

type zoneResp struct {
    Success bool `json:"success"`
    Result  []struct {
        ID   string `json:"id"`
        Name string `json:"name"`
    } `json:"result"`
    Errors []any `json:"errors"`
}

func (h *CloudflareHandler) ListZones(c *gin.Context) {
    role, _ := c.Get("role")
    if role == "viewer" {
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
        return
    }

    token, err := h.fetchSecret("CF_TOKEN")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "CF_TOKEN missing"})
        return
    }
    accountID, err := h.fetchSecret("CF_ACCOUNT_ID")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "CF_ACCOUNT_ID missing"})
        return
    }

    query := c.Query("search")
    apiURL := "https://api.cloudflare.com/client/v4/zones?status=active&per_page=50"
    if accountID != "" {
        apiURL = fmt.Sprintf("https://api.cloudflare.com/client/v4/zones?account.id=%s&status=active&per_page=50", accountID)
    }
    if query != "" {
        apiURL += "&name=" + url.QueryEscape(query)
    }
    resp, err := h.cfRequest("GET", apiURL, token, nil)
    if err != nil {
        c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
        return
    }
    defer resp.Body.Close()

    var zr zoneResp
    if err := json.NewDecoder(resp.Body).Decode(&zr); err != nil {
        c.JSON(http.StatusBadGateway, gin.H{"error": "decode failed"})
        return
    }
    if !zr.Success {
        c.JSON(http.StatusBadGateway, gin.H{"error": "cloudflare error"})
        return
    }
    out := make([]gin.H, len(zr.Result))
    for i, z := range zr.Result {
        out[i] = gin.H{"id": z.ID, "name": z.Name}
    }
    c.JSON(http.StatusOK, out)
}

type createDNSReq struct {
    Name    string `json:"name" binding:"required"`   // subdomain or FQDN
    Content string `json:"content" binding:"required"` // IP address
}

type dnsResp struct {
    Success bool `json:"success"`
}

func (h *CloudflareHandler) CreateDNS(c *gin.Context) {
    role, _ := c.Get("role")
    if role != "admin" && role != "superadmin" {
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
        return
    }

    var req createDNSReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    zoneID := c.Param("id")
    if zoneID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "zone id required"})
        return
    }

    token, err := h.fetchSecret("CF_TOKEN")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "CF_TOKEN missing"})
        return
    }

    body, _ := json.Marshal(gin.H{
        "type":    "A",
        "name":    req.Name,
        "content": req.Content,
        "ttl":     300,
        "proxied": false,
    })

    apiURL := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records", zoneID)
    resp, err := h.cfRequest("POST", apiURL, token, io.NopCloser(bytes.NewReader(body)))
    if err != nil {
        c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
        return
    }
    defer resp.Body.Close()

    var dr dnsResp
    _ = json.NewDecoder(resp.Body).Decode(&dr)
    if !dr.Success {
        c.JSON(http.StatusBadGateway, gin.H{"error": "cloudflare dns error"})
        return
    }
    c.Status(http.StatusCreated)
}
