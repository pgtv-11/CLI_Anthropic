variable "region" {
  type        = string
  description = "Primary AWS region"
  default     = "us-east-1"
}

variable "replica_region" {
  type        = string
  description = "Cross-region replica AWS region (must differ from primary)"
  default     = "us-west-2"
  validation {
    condition     = var.replica_region != var.region
    error_message = "replica_region must differ from region."
  }
}

variable "bucket_name" {
  type        = string
  description = "WORM bucket name. Convention: avenue-worm-<domain>-<env>"
}

variable "domain" {
  type        = string
  description = "Compliance domain backed by this bucket"
  validation {
    condition = contains(
      ["audit-log", "comms-archive", "evidence-packages", "books-records", "regulatory-filings"],
      var.domain,
    )
    error_message = "domain must be one of audit-log, comms-archive, evidence-packages, books-records, regulatory-filings."
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "stg", "prod"], var.environment)
    error_message = "environment must be dev, stg or prod."
  }
}

variable "retention_days" {
  type        = number
  description = "Default Object Lock retention in days. SEC 17a-4 minimum: ~6 years; we set 7 years for safety."
  default     = 2557 # ≈ 7 years
  validation {
    condition     = var.retention_days >= 2190
    error_message = "retention_days must be >= 2190 (~6 years) to satisfy 17a-4."
  }
}

variable "access_log_bucket" {
  type        = string
  description = "Bucket receiving S3 access logs for this WORM bucket"
}
