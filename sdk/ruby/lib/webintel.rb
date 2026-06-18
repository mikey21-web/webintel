require "httparty"

class WebIntel
  include HTTParty

  def initialize(api_key, base_url = "https://api.webintel.dev")
    @api_key = api_key
    self.class.base_uri(base_url)
  end

  private

  def headers
    { "Authorization" => "Bearer #{@api_key}", "Content-Type" => "application/json", "User-Agent" => "webintel-ruby-sdk/0.1.0" }
  end

  def post(path, body = {})
    3.times do |attempt|
      response = self.class.post(path, body: body.to_json, headers: headers, timeout: 30)
      if [429, 502, 503].include?(response.code) && attempt < 2
        sleep(2 ** attempt)
        next
      end
      raise response.parsed_response["error"] || "HTTP #{response.code}" unless response.success?
      return response.parsed_response
    end
  end

  def get(path)
    3.times do |attempt|
      response = self.class.get(path, headers: headers, timeout: 30)
      if [429, 502, 503].include?(response.code) && attempt < 2
        sleep(2 ** attempt)
        next
      end
      raise response.parsed_response["error"] || "HTTP #{response.code}" unless response.success?
      return response.parsed_response
    end
  end

  public

  def scrape(url, use_js: nil, wait_for: nil)
    post("/v1/web/scrape/markdown", { url: url, useJs: use_js, waitFor: wait_for }.compact)
  end

  def scrape_html(url)
    post("/v1/web/scrape/html", { url: url })
  end

  def sitemap(url)
    post("/v1/web/sitemap", { url: url })
  end

  def screenshot(url, full_page: nil, wait_for: nil)
    post("/v1/web/screenshot", { url: url, fullPage: full_page, waitFor: wait_for }.compact)
  end

  def extract(url, schema: nil, prompt: nil)
    post("/v1/web/extract", { url: url, schema: schema, prompt: prompt }.compact)
  end

  def crawl(url, max_pages: nil, webhook_url: nil)
    post("/v1/web/crawl", { url: url, maxPages: max_pages, webhookUrl: webhook_url }.compact)
  end

  def get_crawl_job(job_id)
    get("/v1/web/crawl/#{job_id}")
  end

  def search(query, num_results: nil)
    post("/v1/web/search", { query: query, numResults: num_results }.compact)
  end

  def query(url, question)
    post("/v1/web/query", { url: url, question: question })
  end

  def brand_profile(domain)
    get("/v1/brand/profile?domain=#{CGI.escape(domain)}")
  end

  def brand_logo(domain)
    get("/v1/brand/logo?domain=#{CGI.escape(domain)}")
  end

  def brand_colors(domain)
    get("/v1/brand/colors?domain=#{CGI.escape(domain)}")
  end

  def brand_fonts(domain)
    get("/v1/brand/fonts?domain=#{CGI.escape(domain)}")
  end

  def brand_socials(domain)
    get("/v1/brand/socials?domain=#{CGI.escape(domain)}")
  end

  def brand_tech_stack(domain)
    get("/v1/brand/techstack?domain=#{CGI.escape(domain)}")
  end

  def brand_styleguide(domain)
    get("/v1/brand/styleguide?domain=#{CGI.escape(domain)}")
  end

  def brand_address(domain)
    get("/v1/brand/address?domain=#{CGI.escape(domain)}")
  end

  def classify(domain)
    get("/v1/brand/classify?domain=#{CGI.escape(domain)}")
  end

  def logo_url(domain)
    "#{self.class.base_uri}/v1/logo/#{domain}"
  end

  def health
    get("/health")
  end
end
