terraform {
  required_version = ">= 1.16.6, < 2.0.0"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.28.0" }
  }
}
provider "cloudflare" {}
variable "cloudflare_account_id" { type = string }
resource "cloudflare_r2_bucket" "state" {
  account_id = var.cloudflare_account_id
  name       = "saavirta-terraform-state"
  location   = "WEUR"
  lifecycle { prevent_destroy = true }
}
