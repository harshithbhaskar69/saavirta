resource "cloudflare_workers_kv_namespace" "weather" {
  account_id = var.cloudflare_account_id
  title      = "saavirta-weather-production"
  lifecycle { prevent_destroy = true }
}
