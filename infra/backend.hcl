bucket                      = "saavirta-terraform-state"
key                         = "production/terraform.tfstate"
region                      = "auto"
endpoints                   = { s3 = "https://8e2cf20009daa5e8f59cf38d3ddce77f.r2.cloudflarestorage.com" }
skip_credentials_validation = true
skip_metadata_api_check     = true
skip_region_validation      = true
skip_requesting_account_id  = true
skip_s3_checksum            = true
use_path_style              = true
use_lockfile                = true
