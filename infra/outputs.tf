output "worker_config" {
  value = {
    account_id         = var.cloudflare_account_id
    name               = "www"
    weather_cache_id   = cloudflare_workers_kv_namespace.weather.id
    market_database_id = cloudflare_d1_database.markets.id
    workers_dev_url    = "https://www.${var.workers_subdomain}.workers.dev"
  }
}
