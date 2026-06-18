package webintel

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

type Option func(*Client)

func WithAPIKey(key string) Option {
	return func(c *Client) { c.apiKey = key }
}

func WithBaseURL(u string) Option {
	return func(c *Client) { c.baseURL = u }
}

func NewClient(opts ...Option) *Client {
	c := &Client{
		baseURL: "https://api.webintel.dev",
		http:    &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) request(method, path string, body any) ([]byte, error) {
	retryable := map[int]bool{429: true, 502: true, 503: true}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		var reqBody io.Reader
		if body != nil {
			b, err := json.Marshal(body)
			if err != nil {
				return nil, err
			}
			reqBody = bytes.NewReader(b)
		}
		req, err := http.NewRequest(method, c.baseURL+path, reqBody)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "webintel-go-sdk/0.1.0")
		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = err
			if attempt < 2 {
				time.Sleep(time.Duration(1<<attempt) * time.Second)
				continue
			}
			return nil, err
		}
		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= 400 {
			if retryable[resp.StatusCode] && attempt < 2 {
				time.Sleep(time.Duration(1<<attempt) * time.Second)
				continue
			}
			var errResp struct {
				Error string `json:"error"`
			}
			json.Unmarshal(respBody, &errResp)
			if errResp.Error != "" {
				return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, errResp.Error)
			}
			return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
		}
		return respBody, nil
	}
	return nil, lastErr
}

func (c *Client) get(path string) ([]byte, error) {
	return c.request("GET", path, nil)
}

func (c *Client) post(path string, body any) ([]byte, error) {
	return c.request("POST", path, body)
}

// --- Types ---

type ScrapeResult struct {
	Markdown string `json:"markdown"`
	Metadata struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		OgImage     string `json:"ogImage"`
	} `json:"metadata"`
	Source string `json:"source"`
}

type ScrapeOptions struct {
	UseJs   *bool `json:"useJs,omitempty"`
	WaitFor *int  `json:"waitFor,omitempty"`
	Stealth *bool `json:"stealth,omitempty"`
}

type ScrapeOption func(*ScrapeOptions)

// --- Web Scraping ---

func (c *Client) Scrape(targetURL string, opts ...ScrapeOption) (*ScrapeResult, error) {
	so := &ScrapeOptions{}
	for _, opt := range opts {
		opt(so)
	}
	body := map[string]any{"url": targetURL}
	if so.UseJs != nil {
		body["useJs"] = *so.UseJs
	}
	if so.WaitFor != nil {
		body["waitFor"] = *so.WaitFor
	}
	if so.Stealth != nil {
		body["stealth"] = *so.Stealth
	}
	b, err := c.post("/v1/web/scrape/markdown", body)
	if err != nil {
		return nil, err
	}
	var result ScrapeResult
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) ScrapeHTML(targetURL string) (*ScrapeResult, error) {
	body := map[string]any{"url": targetURL}
	b, err := c.post("/v1/web/scrape/html", body)
	if err != nil {
		return nil, err
	}
	var result ScrapeResult
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) Extract(targetURL string, schema map[string]any, prompt string) (map[string]any, error) {
	body := map[string]any{"url": targetURL}
	if schema != nil {
		body["schema"] = schema
	}
	if prompt != "" {
		body["prompt"] = prompt
	}
	b, err := c.post("/v1/web/extract", body)
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) Crawl(targetURL string, maxPages int, webhookUrl string) (map[string]any, error) {
	body := map[string]any{"url": targetURL}
	if maxPages > 0 {
		body["maxPages"] = maxPages
	}
	if webhookUrl != "" {
		body["webhookUrl"] = webhookUrl
	}
	b, err := c.post("/v1/web/crawl", body)
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) GetCrawlJob(jobID string) (map[string]any, error) {
	b, err := c.get("/v1/web/crawl/" + url.PathEscape(jobID))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) Search(query string, numResults int) (map[string]any, error) {
	body := map[string]any{"query": query}
	if numResults > 0 {
		body["numResults"] = numResults
	}
	b, err := c.post("/v1/web/search", body)
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) Query(targetURL, question string) (map[string]any, error) {
	body := map[string]any{
		"url":      targetURL,
		"question": question,
	}
	b, err := c.post("/v1/web/query", body)
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// --- Brand Intelligence ---

func (c *Client) BrandProfile(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/profile?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandLogo(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/logo?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandColors(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/colors?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandFonts(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/fonts?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandSocials(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/socials?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandTechStack(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/techstack?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandStyleguide(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/styleguide?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) BrandAddress(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/address?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) Classify(domain string) (map[string]any, error) {
	b, err := c.get("/v1/brand/classify?domain=" + url.QueryEscape(domain))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) LogoURL(domain string) string {
	return "https://cdn.webintel.dev/logo/" + domain + ".png"
}

func (c *Client) Health() (map[string]any, error) {
	b, err := c.get("/health")
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}
	return result, nil
}
