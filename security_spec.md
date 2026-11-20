# Security Specification & Payload-First TDD

## 1. Data Invariants
1. A `Proposal` document at `/proposals/{proposalId}` must have a `proposalId` between 10 and 64 characters matching `^[a-zA-Z0-9_-]+$`.
2. Proposals cannot be listed (`allow list: if false`), preventing enumeration across users.
3. On creation, a `Proposal` must start in `status: "waiting"`, `noDodges: 0`, `treatClicks: 0`, empty selection fields (`day`, `time`, `plan`, `treatChoice`, `letter`), and `createdAt == request.time`.
4. `senderName`, `receiverName`, and `createdAt` are strictly immutable after creation.
5. State transitions are strictly monotonic (`waiting` -> `opened` -> `said_yes`), `noDodges` and `treatClicks` can only increment by `+1` per action, and once `letter` is non-empty (sealed), the proposal is locked against further edits.
6. A `DashboardAccess` document at `/dashboardAccess/{accessId}` uses `${proposalId}_${pin}` as its ID, cannot be listed (`allow list: if false`), and must reference an existing `/proposals/{proposalId}` atomically (`existsAfter`).

## 2. Dirty Dozen Adversarial Payloads
1. **Collection Enumeration**: `list /proposals` -> `PERMISSION_DENIED`
2. **Access Key Enumeration**: `list /dashboardAccess` -> `PERMISSION_DENIED`
3. **Oversized ID Poisoning**: `create /proposals/${'a'.repeat(300)}` -> `PERMISSION_DENIED`
4. **Shadow Field Injection**: `create /proposals/validId1234` with extra field `isAdmin: true` -> `PERMISSION_DENIED`
5. **Pre-Completed Create**: `create /proposals/validId1234` with `status: "said_yes"` -> `PERMISSION_DENIED`
6. **Spoofed Timestamp**: `create /proposals/validId1234` with client `createdAt` != `request.time` -> `PERMISSION_DENIED`
7. **Mutate Immutable Sender Name**: `update /proposals/validId1234` changing `senderName` -> `PERMISSION_DENIED`
8. **Backward Status Regression**: `update /proposals/validId1234` changing `status` from `said_yes` to `waiting` -> `PERMISSION_DENIED`
9. **Counter Jump Attack**: `update /proposals/validId1234` incrementing `treatClicks` by `+500` in one write -> `PERMISSION_DENIED`
10. **Post-Seal Tampering**: `update /proposals/validId1234` modifying `letter` or `treatChoice` after `letter` is already non-empty -> `PERMISSION_DENIED`
11. **Value Poisoning**: `update /proposals/validId1234` setting `letter` to a 10,000-char string -> `PERMISSION_DENIED`
12. **Orphaned Dashboard Key**: `create /dashboardAccess/fakeId_1234` pointing to non-existent `proposalId` -> `PERMISSION_DENIED`
