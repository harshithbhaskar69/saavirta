mock_provider "cloudflare" {}
variables {
  cloudflare_account_id   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  workers_subdomain       = "test-account"
  access_worker_id        = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  access_allowed_emails   = ["owner@example.test"]
  access_service_token_id = "11111111-1111-4111-8111-111111111111"
}
run "managed_storage" {
  command = plan
  assert {
    condition     = cloudflare_d1_database.markets.jurisdiction == "eu" && cloudflare_d1_database.markets.read_replication.mode == "disabled"
    error_message = "Keep market storage in the EU with consistent primary reads."
  }
  assert {
    condition     = output.worker_config.workers_dev_url == "https://www.test-account.workers.dev"
    error_message = "Preserve the selected account subdomain."
  }
}
run "reject_invalid_account" {
  command = plan
  variables { cloudflare_account_id = "invalid" }
  expect_failures = [var.cloudflare_account_id]
}
run "reject_invalid_subdomain" {
  command = plan
  variables { workers_subdomain = "https://wrong.example" }
  expect_failures = [var.workers_subdomain]
}
run "access_is_invite_only" {
  command = plan
  assert {
    condition     = length(cloudflare_zero_trust_access_application.saavirta.destinations) == 1 && one(cloudflare_zero_trust_access_application.saavirta.destinations).type == "worker" && one(cloudflare_zero_trust_access_application.saavirta.destinations).worker_id == var.access_worker_id
    error_message = "Protect the entire Worker, including preview URLs."
  }
  assert {
    condition     = length(cloudflare_zero_trust_access_policy.invited.include) == 1 && one(cloudflare_zero_trust_access_policy.invited.include).email.email == "owner@example.test" && cloudflare_zero_trust_access_policy.invited.decision == "allow"
    error_message = "Only invited email addresses may sign in."
  }
  assert {
    condition     = cloudflare_zero_trust_access_policy.verification.decision == "non_identity" && one(cloudflare_zero_trust_access_policy.verification.include).service_token.token_id == var.access_service_token_id
    error_message = "Release verification must require the specific service token."
  }
}
run "reject_empty_invitation_list" {
  command = plan
  variables { access_allowed_emails = [] }
  expect_failures = [var.access_allowed_emails]
}
