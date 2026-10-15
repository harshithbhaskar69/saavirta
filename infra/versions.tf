terraform {
  backend "s3" {}
  required_version = ">= 1.16.6, < 2.0.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.28.0"
    }
  }
}

# Provider credentials are injected from Infisical, never supplied as variables.
provider "cloudflare" {}
