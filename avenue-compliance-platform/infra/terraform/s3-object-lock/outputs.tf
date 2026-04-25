output "bucket_arn" {
  value       = aws_s3_bucket.worm.arn
  description = "Primary WORM bucket ARN"
}

output "bucket_name" {
  value = aws_s3_bucket.worm.bucket
}

output "replica_bucket_arn" {
  value = aws_s3_bucket.replica.arn
}

output "kms_key_arn" {
  value = aws_kms_key.worm.arn
}
