# SEC Rule 17a-4(f) WORM archive — S3 Object Lock in COMPLIANCE mode.
#
# This module is the materialization of P2 (WORM Archive) in the platform
# architecture. Buckets created here back: audit log, comms archive, evidence
# packages, regulatory filings, and books-and-records artifacts.
#
# DO NOT change retention_mode to GOVERNANCE without an enforcement-attorney sign-off:
# GOVERNANCE allows privileged users to shorten or remove retention, which voids
# the 17a-4(f) non-rewriteable/non-erasable representation.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.60"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      "compliance:control"     = "SEC-17a-4(f)"
      "compliance:domain"      = var.domain
      "compliance:environment" = var.environment
      "compliance:owner"       = "compliance-engineering"
    }
  }
}

# Replica region — cross-region copy required for resilience and FINRA exam continuity.
provider "aws" {
  alias  = "replica"
  region = var.replica_region
  default_tags {
    tags = {
      "compliance:control"     = "SEC-17a-4(f)"
      "compliance:domain"      = var.domain
      "compliance:environment" = var.environment
      "compliance:owner"       = "compliance-engineering"
      "compliance:role"        = "replica"
    }
  }
}

resource "aws_kms_key" "worm" {
  description             = "CMK for WORM bucket ${var.bucket_name}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.kms.json
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "kms" {
  statement {
    sid     = "EnableRootPermissions"
    actions = ["kms:*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    resources = ["*"]
  }
}

resource "aws_s3_bucket" "worm" {
  bucket              = var.bucket_name
  object_lock_enabled = true
  force_destroy       = false
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "worm" {
  bucket = aws_s3_bucket.worm.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "worm" {
  bucket = aws_s3_bucket.worm.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.retention_days
    }
  }
  depends_on = [aws_s3_bucket_versioning.worm]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "worm" {
  bucket = aws_s3_bucket.worm.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.worm.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "worm" {
  bucket                  = aws_s3_bucket.worm.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "worm" {
  bucket        = aws_s3_bucket.worm.id
  target_bucket = var.access_log_bucket
  target_prefix = "${var.bucket_name}/"
}

# Replica bucket — also Object Lock COMPLIANCE.
resource "aws_kms_key" "replica" {
  provider                = aws.replica
  description             = "CMK for WORM replica ${var.bucket_name}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_s3_bucket" "replica" {
  provider            = aws.replica
  bucket              = "${var.bucket_name}-replica"
  object_lock_enabled = true
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "replica" {
  provider = aws.replica
  bucket   = aws_s3_bucket.replica.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "replica" {
  provider = aws.replica
  bucket   = aws_s3_bucket.replica.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.retention_days
    }
  }
  depends_on = [aws_s3_bucket_versioning.replica]
}

resource "aws_iam_role" "replication" {
  name               = "${var.bucket_name}-replication"
  assume_role_policy = data.aws_iam_policy_document.replication_assume.json
}

data "aws_iam_policy_document" "replication_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

resource "aws_s3_bucket_replication_configuration" "worm" {
  depends_on = [aws_s3_bucket_versioning.worm]
  bucket     = aws_s3_bucket.worm.id
  role       = aws_iam_role.replication.arn

  rule {
    id     = "primary-to-replica"
    status = "Enabled"
    delete_marker_replication { status = "Disabled" }
    destination {
      bucket        = aws_s3_bucket.replica.arn
      storage_class = "DEEP_ARCHIVE"
      encryption_configuration {
        replica_kms_key_id = aws_kms_key.replica.arn
      }
    }
    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }
    filter {}
  }
}
