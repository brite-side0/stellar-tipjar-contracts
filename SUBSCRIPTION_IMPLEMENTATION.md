# Recurring Tip Subscriptions - Implementation Summary

## Overview
Added subscription-based recurring tips where supporters can set up automatic periodic payments to creators.

## Changes Made

### 1. Contract Types (`contracts/tipjar/src/lib.rs`)

**New Types:**
- `SubscriptionStatus` enum: `Active`, `Paused`, `Cancelled`
- `Subscription` struct with fields:
  - `subscriber`, `creator`, `token`: addresses
  - `amount`: tip amount per payment
  - `interval_seconds`: minimum time between payments
  - `last_payment`, `next_payment`: timestamps
  - `status`: current subscription state

**Storage:**
- Added `DataKey::Subscription(Address, Address)` for (subscriber, creator) pairs

**Error Codes:**
- `SubscriptionNotFound = 24`
- `SubscriptionNotActive = 25`
- `PaymentNotDue = 26`
- `InvalidInterval = 27`

### 2. Contract Methods

**`create_subscription`**
- Creates a new subscription with amount and interval
- Minimum interval: 1 day (86,400 seconds)
- First payment due immediately (at creation time)
- Emits `("sub_new", creator)` event

**`execute_subscription_payment`**
- Executes a due payment (anyone can call)
- Validates subscription is active and payment is due
- Transfers tokens from subscriber to contract escrow
- Updates creator balance and total tips
- Advances `next_payment` by `interval_seconds`
- Emits `("sub_pay", creator)` event

**`pause_subscription`**
- Pauses an active subscription (subscriber only)
- Prevents payment execution while paused
- Emits `("sub_paus", creator)` event

**`resume_subscription`**
- Resumes a paused subscription (subscriber only)
- Resets `next_payment` to current time
- Emits `("sub_res", creator)` event

**`cancel_subscription`**
- Cancels a subscription (subscriber only)
- Sets status to `Cancelled` (permanent)
- Emits `("sub_cncl", creator)` event

**`get_subscription`**
- Returns subscription details or `None` if not found

### 3. Tests (`tests/subscription_tests.rs`)

Comprehensive test coverage:
- ✅ Subscription creation with validation
- ✅ Payment execution and timing
- ✅ Balance updates (withdrawable + total)
- ✅ Interval enforcement
- ✅ Pause/resume functionality
- ✅ Cancellation
- ✅ Error handling for all edge cases

## Key Features

1. **Flexible Intervals**: Any interval ≥ 1 day (monthly, weekly, etc.)
2. **Status Management**: Active → Paused → Active or Active → Cancelled
3. **Automatic Tracking**: Contract tracks last/next payment timestamps
4. **Event Emission**: All state changes emit events for off-chain indexing
5. **Balance Integration**: Payments update creator balances like regular tips
6. **Token Support**: Works with any whitelisted token

## Usage Example

```rust
// Create monthly subscription
tipjar.create_subscription(
    &subscriber,
    &creator,
    &token,
    &100,  // amount per payment
    &2_592_000  // 30 days in seconds
);

// Execute payment (anyone can call when due)
tipjar.execute_subscription_payment(&subscriber, &creator);

// Pause subscription
tipjar.pause_subscription(&subscriber, &creator);

// Resume subscription
tipjar.resume_subscription(&subscriber, &creator);

// Cancel subscription
tipjar.cancel_subscription(&subscriber, &creator);
```

## Build & Test

```bash
# Build contract
cargo build -p tipjar --target wasm32v1-none --release

# Run tests
cargo test -p tipjar subscription_tests
```

## Notes

- Subscriptions are stored per (subscriber, creator) pair
- Only one subscription allowed per pair (can be updated by canceling and recreating)
- Payment execution requires subscriber to have sufficient token balance
- Cancelled subscriptions cannot be resumed (must create new subscription)
- Paused subscriptions can be resumed at any time
