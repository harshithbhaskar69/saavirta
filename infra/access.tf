resource "cloudflare_zero_trust_access_identity_provider" "email" {
  account_id = var.cloudflare_account_id
  name       = "Email code"
  type       = "onetimepin"
  config     = {}
}

resource "cloudflare_zero_trust_access_policy" "invited" {
  account_id       = var.cloudflare_account_id
  name             = "Saavirta invited users"
  decision         = "allow"
  session_duration = "8h"
  include = [for email in var.access_allowed_emails : {
    email = { email = email }
  }]
}

resource "cloudflare_zero_trust_access_policy" "verification" {
  account_id = var.cloudflare_account_id
  name       = "Saavirta release verification"
  decision   = "non_identity"
  include    = [{ service_token = { token_id = var.access_service_token_id } }]
}

resource "cloudflare_zero_trust_access_application" "saavirta" {
  account_id                 = var.cloudflare_account_id
  name                       = "Saavirta"
  type                       = "self_hosted"
  destinations               = [{ type = "worker", worker_id = var.access_worker_id }]
  allowed_idps               = [cloudflare_zero_trust_access_identity_provider.email.id]
  session_duration           = "8h"
  http_only_cookie_attribute = true
  same_site_cookie_attribute = "lax"
  policies = [
    { id = cloudflare_zero_trust_access_policy.verification.id, precedence = 1 },
    { id = cloudflare_zero_trust_access_policy.invited.id, precedence = 2 },
  ]
}
