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
variable "access_worker_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.access_worker_id))
    error_message = "Set the existing Worker's ID for Access protection."
  }
}
variable "access_allowed_emails" {
  type      = set(string)
  sensitive = true
  validation {
    condition     = length(var.access_allowed_emails) > 0 && alltrue([for email in var.access_allowed_emails : can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", email))])
    error_message = "Set a non-empty list of invited email addresses."
  }
}
variable "access_service_token_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9-]{36}$", var.access_service_token_id))
    error_message = "Set the Access verification token ID; never its secret."
  }
}
