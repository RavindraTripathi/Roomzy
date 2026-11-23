# ROOMZY Security Specification (Phase 0)

## Data Invariants
1. **PII Isolation**: Private user fields (`email`, `phone`, `subscriptionTier`, `verificationStatus`, `isBanned`, `isSuspended`) live strictly under `/users/{userId}` and `/verifications/{id}` and are never readable by other non-admin users. Discoverable `/profiles/{userId}` documents must never store raw Aadhaar/PAN numbers, phone numbers, or email addresses.
2. **Self-Role & Self-Verification Prevention**: A user cannot set `isVerified: true` or `subscriptionTier: "premium"` on creation or update via client SDK without verified admin/server authorization.
3. **Participant-Bound Conversations & Messages**: Only the two participants listed in `/conversations/{id}.participants` (size == 2) can read or post messages to `/conversations/{id}/messages/{msgId}`.
4. **Immutable Authorship**: `ownerUid`, `fromUid`, `reporterUid`, `senderUid`, and `createdAt` cannot be modified after creation.
5. **No Blanket Public Listing of Private Records**: `likes`, `matches`, `conversations`, `verifications`, `subscriptions`, `notifications`, and `reports` enforce `resource.data` ownership/participant checks on `allow list` and `allow get`.

## Dirty Dozen Adversarial Payloads
1. **Self-Verify Spoof**: `POST /profiles/uidA { ..., isVerified: true }` -> `PERMISSION_DENIED`
2. **Self-Premium Escalation**: `PATCH /users/uidA { subscriptionTier: "premium" }` -> `PERMISSION_DENIED`
3. **Ghost Field Injection**: `PATCH /profiles/uidA { fullName: "Test", adminOverride: true }` -> `PERMISSION_DENIED`
4. **Cross-User Profile Hijack**: `PATCH /profiles/uidB { monthlyBudget: 5000 }` by `uidA` -> `PERMISSION_DENIED`
5. **PII Snooping**: `GET /users/uidB` by `uidA` -> `PERMISSION_DENIED`
6. **KYC Document Snooping**: `GET /verifications/verB` by `uidA` -> `PERMISSION_DENIED`
7. **ID Poisoning (1.5KB ID)**: `PUT /profiles/<1500_char_id>` -> `PERMISSION_DENIED`
8. **Fake Match Forgery**: `POST /matches/m1 { users: ["uidB", "uidC"], user1Uid: "uidB", user2Uid: "uidC" }` by `uidA` -> `PERMISSION_DENIED`
9. **Chat Intrusion**: `POST /conversations/convBC/messages/msg1 { senderUid: "uidA", text: "hi" }` by `uidA` -> `PERMISSION_DENIED`
10. **Sender Impersonation**: `POST /conversations/convAB/messages/msg1 { senderUid: "uidB", text: "spoof" }` by `uidA` -> `PERMISSION_DENIED`
11. **Report Tampering**: `PATCH /reports/rep1 { status: "dismissed" }` by `uidA` (non-admin) -> `PERMISSION_DENIED`
12. **Client Timestamp Forgery**: `POST /property_listings/l1 { ..., createdAt: "2020-01-01T00:00:00Z" }` -> `PERMISSION_DENIED`
