resource "cloudflare_d1_database" "markets" {
  account_id       = var.cloudflare_account_id
  name             = "saavirta-markets"
  jurisdiction     = "eu"
  read_replication = { mode = "disabled" }
  lifecycle { prevent_destroy = true }
}
