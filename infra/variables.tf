variable "cloudflare_account_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_account_id))
    error_message = "Set a valid Cloudflare account ID."
  }
}
variable "workers_subdomain" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$", var.workers_subdomain))
    error_message = "Set the account's existing Workers subdomain."
  }
}
