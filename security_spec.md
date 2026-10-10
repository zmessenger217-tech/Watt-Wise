# Security Specification — WattWise Electricity Unit & Bill Manager

## 1. Data Invariants

1. **Strict Tenant Isolation**: Every document across `/users/{userId}`, `/meters/{meterId}`, `/months/{monthId}`, `/readings/{readingId}`, `/notifications/{notificationId}`, and `/auditLogs/{logId}` must have `data.userId == request.auth.uid` and `userId == request.auth.uid`, and the requester must have `request.auth.token.email_verified == true`.
2. **Master Gate Relational Integrity**:
   - A `meter` document cannot be created or accessed unless its parent `/users/{userId}` document exists and belongs to `request.auth.uid`.
   - A `month` document cannot be created or accessed unless its parent `/users/{userId}/meters/{meterId}` document exists and belongs to `request.auth.uid`.
   - A `reading` document cannot be created or accessed unless its parent `/users/{userId}/meters/{meterId}/months/{monthId}` document exists and belongs to `request.auth.uid`.
   - A `notification` or `auditLog` cannot be created unless `/users/{userId}` exists and belongs to `request.auth.uid`.
3. **Non-Negative Consumption Invariant**: `unitsConsumed >= 0`, `openingReading >= 0`, `currentReading >= 0`, `monthlyLimit >= 1`.
4. **Temporal & Identity Immutability**: `createdAt`, `userId`, `meterId`, `monthId`, `readingId`, `notificationId`, and `logId` are strictly immutable after document creation. `createdAt` and `updatedAt` must equal `request.time`.
5. **Audit Trail Immutability**: Documents in `/users/{userId}/auditLogs/{logId}` are append-only (`allow update, delete: if false`).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on User Profile)**: Authenticated User A attempts to create `/users/userB` with `userId: "userB"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Unverified Email Write)**: User with `email_verified: false` attempts to create `/users/userA`. -> `PERMISSION_DENIED`
3. **Payload 3 (Shadow Field Injection on Meter)**: User sends valid `ElectricityMeter` payload plus `"isAdmin": true`. -> `PERMISSION_DENIED` (blocked by `hasOnly`)
4. **Payload 4 (Orphaned Meter Creation)**: User attempts to create `/users/userA/meters/meter1` before `/users/userA` exists. -> `PERMISSION_DENIED` (blocked by `exists()`)
5. **Payload 5 (ID Poisoning Attack)**: User attempts to create a meter with document ID containing spaces or special characters (`meter$123!`). -> `PERMISSION_DENIED` (blocked by `isValidId`)
6. **Payload 6 (Negative Units Consumed)**: User attempts to create or update a meter with `unitsConsumed: -50`. -> `PERMISSION_DENIED`
7. **Payload 7 (Timestamp Forgery)**: User attempts to create a reading with a backdated `createdAt` timestamp not equal to `request.time`. -> `PERMISSION_DENIED`
8. **Payload 8 (Immutable Field Mutation)**: User attempts to update `createdAt` or `meterId` on an existing `ElectricityMeter`. -> `PERMISSION_DENIED`
9. **Payload 9 (Cross-Tenant List Scraping)**: User A attempts to `list` `/users/userB/meters`. -> `PERMISSION_DENIED`
10. **Payload 10 (PII Leakage on User Profile)**: User A attempts to `get` `/users/userB` containing email and preferences. -> `PERMISSION_DENIED`
11. **Payload 11 (String Buffer Overflow / Denial of Wallet)**: User attempts to set `meterName` to a 5,000-character string (exceeding `maxLength: 80`). -> `PERMISSION_DENIED`
12. **Payload 12 (Audit Log Tampering)**: User attempts to `update` or `delete` an existing `/users/userA/auditLogs/log1` document. -> `PERMISSION_DENIED`
