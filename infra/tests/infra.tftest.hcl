mock_provider "cloudflare" {}
variables {
  cloudflare_account_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  workers_subdomain     = "test-account"
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
