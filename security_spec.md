# Security Specification for Evolutia Multi-player

## 1. Data Invariants
1. **Protected Personal Ownership**: A player cannot modify or create another player's profile (`/users/{userId}`). Only the owner (the user with matching `request.auth.uid`) can write to their own profile.
2. **Read Access**: Any registered/authenticated user can read another player's public profile data to populate the Lobby list and the 3D Interactive Neighborhood map.
3. **Chat Message Integrity**: Users can send messages to the `/chat` collection, but the message's `userId` must strictly match their authenticated UID, preventing identity impersonation.
4. **Chat Non-Modifiability**: Chat messages are append-only. Once created, they cannot be updated or deleted by normal users.
5. **No Negative Attributes**: Gold and Exp must be non-negative integers.
6. **Immutable Timestamp**: Chat message timers or last entry times must align with secure server-side clock timestamps where applicable.

---

## 2. The "Dirty Dozen" Malicious Payloads
The following malicious payloads seek to spoof credentials, forge identities, and hijack game state. Our firestore rules are designed to prevent all of them.

### User Collection Attacks (`/users/{userId}`)
1. **Spoofed Ownership Write**: `userId` is `VictimUID`, written from an authenticated session of `AttackerUID`.
2. **Negative Gold Forgery**: Setting negative gold to overflow or corrupt the player's wallet.
3. **Admin Privilege Self-Assignment**: Set `isAdmin` or other privileges on profile registration.
4. **Invalid String Injection (Denial of Wallet)**: Inject a high-volume 1MB payload string to bloat doc storage.
5. **Non-Verified User Writing**: User attempts profile changes with a non-verified email address or without authenticating.
6. **Immutable Field Updates**: Attempting to alter a read-only field or bypass progressive steps.

### Chat Collection Attacks (`/chat/{messageId}`)
7. **Identity Hijacking (Sender Impersonation)**: Writing a chat message where the field `userId` is `AttackerUID` but `sender` is set to `VictimName`.
8. **Spoofed User UID**: Writing a chat message where `userId` is set to `VictimUID` while authenticated as `AttackerUID`.
9. **Message Mutation Exploit**: Updating an existing message to modify its text or parameters.
10. **Malicious Link/Spam Injection**: Injecting strings exceeding length constraints.
11. **Chat Deletion Wipe**: Unauthorized deletion of a global chat log by a non-system user.
12. **Fake System Announcement**: Setting `isNitz: true` inside chat to impersonate the system.

---

## 3. Test Invariant Runner Draft
All operations carrying these payloads must yield `PERMISSION_DENIED`.
Rules are asserted in `firestore.rules`.
