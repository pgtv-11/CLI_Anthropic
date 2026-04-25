# Mock 17a-4 Retention Test

Run semi-annually. Goals:

1. Random-sampled records from the WORM bucket are accessible within their easily-accessible window.
2. Object integrity verified by SHA-256 against the manifest.
3. **Programmatic override attempt fails.** The test attempts each of these and they all must be denied:
   - `s3:DeleteObject` on a locked object.
   - `s3:PutObjectRetention` shortening the retention.
   - `s3:PutObjectLegalHold` to disable a hold without dual approval.
   - Bucket-level `s3:DeleteBucket`.

A failure to deny **any** of the above is a P0 finding and triggers immediate CCO notification.

## Procedure

```
$ ./tests/retention-tests/run.sh \
    --bucket avenue-worm-comms-archive-prod \
    --sample-size 100 \
    --report tests/retention-tests/reports/$(date +%Y-%m-%d).json
```

The harness writes a report containing:

- sample object keys and their sha256 vs. manifest sha256
- access latency (p50, p99)
- denial confirmations for each attempted override
- Object Lock retention dates verified against retention policy

The report is itself stored in WORM (separate prefix) so it cannot be silently revised.
