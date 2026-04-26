# Tip Streaming Protocol Implementation

## Overview

The Tip Streaming Protocol implements continuous tip streaming where funds flow in real-time based on time elapsed, similar to the Sablier protocol. This allows for continuous, programmatic tipping from a sender to a creator over a specified duration.

## Architecture

### Core Components

1. **Stream Struct**: Represents a continuous stream of funds
   - `stream_id`: Unique identifier for the stream
   - `sender`: Address sending the funds
   - `creator`: Address receiving the funds
   - `token`: Token contract address
   - `amount_per_second`: Rate of streaming (tokens/second)
   - `start_time`: When the stream starts (Unix timestamp)
   - `end_time`: When the stream ends (Unix timestamp)
   - `withdrawn`: Amount already withdrawn by creator
   - `status`: StreamStatus (Active, Paused, Cancelled, Completed)
   - `created_at`: When the stream was created
   - `updated_at`: Last update timestamp

2. **StreamStatus Enum**: Tracks the state of a stream
   - `Active`: Stream is running and accumulating funds
   - `Paused`: Stream is temporarily stopped
   - `Cancelled`: Stream has been cancelled, remaining funds refunded
   - `Completed`: Stream has finished its duration

3. **Storage Keys**: Efficient data organization
   - `DataKey::Stream(u64)`: Stream record by ID
   - `DataKey::CreatorStreams(Address)`: List of stream IDs for a creator
   - `DataKey::SenderStreams(Address)`: List of stream IDs for a sender
   - `DataKey::StreamCounter`: Global stream counter

4. **Error Handling**: Comprehensive error types
   - `StreamNotFound`: Invalid stream ID
   - `StreamAlreadyCancelled`: Attempting to cancel an already cancelled stream
   - `StreamNotStarted`: Attempting operations on a stream before start time
   - `StreamAlreadyCompleted`: Attempting to cancel a completed stream
   - `InvalidStreamAmount`: Invalid amount specified
   - `InvalidStreamRate`: Invalid rate (≤0)
   - `NoStreamedAmount`: No funds available to withdraw
   - `StreamRateExceedsMaximum`: Rate exceeds 1000 tokens/second

## Key Functions

### 1. Create Stream

```rust
pub fn create_stream(
    env: Env,
    sender: Address,
    creator: Address,
    token: Address,
    amount_per_second: i128,
    duration: u64,
) -> u64
```

Creates a new stream with the specified parameters. The total amount is calculated as `amount_per_second * duration` and transferred to escrow upfront.

**Parameters:**
- `sender`: Address sending the funds (must authorize)
- `creator`: Address receiving the streamed funds
- `token`: Token contract address (must be whitelisted)
- `amount_per_second`: Streaming rate (1-1000 tokens/second)
- `duration`: Stream duration in seconds (must be > 0)

**Returns:** Unique stream ID

**Events:**
- `("stream_created",)` with data `(stream_id, sender, creator, amount_per_second, duration)`

### 2. Calculate Streamed Amount

```rust
fn calculate_streamed_amount(env: &Env, stream: &Stream) -> i128
```

Internal helper that calculates the total amount streamed up to the current time, respecting stream status and duration limits.

**Logic:**
- Returns 0 if current time < start_time
- Returns max amount (rate × duration) if current time > end_time
- Otherwise returns rate × elapsed_time

### 3. Start Stream

```rust
pub fn start_stream(env: Env, sender: Address, stream_id: u64)
```

Starts or resumes a stream. Only the sender can start a stream.

**Parameters:**
- `sender`: Stream sender (must authorize)
- `stream_id`: Stream to start

**Events:**
- `("stream_started",)` with data `(stream_id)`

**Note:** If resuming from paused state, adjusts start_time and end_time to maintain the original duration.

### 4. Stop Stream

```rust
pub fn stop_stream(env: Env, sender: Address, stream_id: u64)
```

Pauses an active stream. Only the sender can stop a stream.

**Parameters:**
- `sender`: Stream sender (must authorize)
- `stream_id`: Stream to pause

**Events:**
- `("stream_stopped",)` with data `(stream_id, streamed_amount)`

**Note:** Updates the withdrawn amount to reflect all accrued funds at the time of pausing.

### 5. Withdraw Streamed Funds

```rust
pub fn withdraw_streamed(env: Env, creator: Address, stream_id: u64)
```

Withdraws all currently available streamed funds for a creator. The creator can withdraw accumulated funds at any time while the stream is active.

**Parameters:**
- `creator`: Stream recipient (must authorize)
- `stream_id`: Stream to withdraw from

**Events:**
- `("stream_withdrawn",)` with data `(stream_id, amount, creator)`

**Logic:**
- Calculates total streamed amount up to now
- Subtracts already withdrawn amount
- Transfers difference to creator
- Marks stream as completed if past end_time

### 6. Cancel Stream

```rust
pub fn cancel_stream(env: Env, sender: Address, stream_id: u64)
```

Cancels an active stream and refunds remaining funds to the sender. Only the sender can cancel.

**Parameters:**
- `sender`: Stream sender (must authorize)
- `stream_id`: Stream to cancel

**Events:**
- `("stream_cancelled",)` with data `(stream_id, refunded_amount)`

**Logic:**
- Calculates total escrowed amount
- Subtracts streamed amount
- Refunds remainder to sender
- Marks stream as cancelled

### 7. Query Functions

```rust
pub fn get_stream(env: Env, stream_id: u64) -> Option<Stream>
pub fn get_streams_by_creator(env: Env, creator: Address) -> Vec<u64>
pub fn get_streams_by_sender(env: Env, sender: Address) -> Vec<u64>
pub fn get_streamed_amount(env: Env, stream_id: u64) -> i128
pub fn get_available_to_withdraw(env: Env, stream_id: u64) -> i128
```

## Usage Examples

### Creating a Stream

```javascript
// Stream 10 tokens/second for 100 seconds (1000 tokens total)
const streamId = await client.create_stream({
    sender: senderAddress,
    creator: creatorAddress,
    token: tokenAddress,
    amountPerSecond: 10n,
    duration: 100n
});
```

### Withdrawing Streamed Funds

```javascript
// Creator withdraws accumulated funds
await client.withdraw_streamed({
    creator: creatorAddress,
    streamId: streamId
});
```

### Pausing and Resuming

```javascript
// Sender pauses the stream
await client.stop_stream({
    sender: senderAddress,
    streamId: streamId
});

// Later, resume the stream
await client.start_stream({
    sender: senderAddress,
    streamId: streamId
});
```

### Cancelling a Stream

```javascript
// Sender cancels, remaining funds refunded
await client.cancel_stream({
    sender: senderAddress,
    streamId: streamId
});
```

## Event System

All streaming operations emit events for off-chain tracking:

| Event | Emitted When | Data |
|-------|-------------|------|
| `stream_created` | Stream is created | `(stream_id, sender, creator, amount_per_second, duration)` |
| `stream_started` | Stream starts/resumes | `(stream_id)` |
| `stream_stopped` | Stream pauses | `(stream_id, streamed_amount)` |
| `stream_withdrawn` | Funds withdrawn | `(stream_id, amount, creator)` |
| `stream_cancelled` | Stream cancelled | `(stream_id, refunded_amount)` |

## Security Considerations

1. **Authorization**: All state-changing operations require proper authorization:
   - Sender must authorize: create, start, stop, cancel
   - Creator must authorize: withdraw

2. **Token Whitelist**: Only whitelisted tokens can be used in streams

3. **Rate Limits**: Maximum streaming rate of 1000 tokens/second prevents abuse

4. **CEI Pattern**: All operations follow the Checks-Effects-Interactions pattern:
   - Validate inputs and state
   - Update contract storage
   - Perform external calls (token transfers) last

5. **Overflow Protection**: All arithmetic uses checked operations

## Integration with Existing Features

### Withdrawal Limits

Stream withdrawals respect existing withdrawal limits and cooldown periods through the standard withdrawal mechanism.

### Events System

Streaming events integrate with the existing event indexing system for efficient querying.

### Multi-Token Support

Streams work with any whitelisted token in the system.

## Testing

Comprehensive test coverage includes:

- Stream creation with valid/invalid parameters
- Streaming rate calculations over time
- Withdrawals at various points
- Pause and resume functionality
- Cancellation and refunds
- Authorization checks
- Edge cases (completed streams, zero amounts, etc.)
- Time-dependent behaviors

## Gas Optimization

- Efficient storage layout with minimal state changes
- Batched operations where possible
- Minimal on-chain computations
- Indexed event storage for efficient queries

## Future Enhancements

Potential extensions:

1. **Stream Modifiers**: Percentage-based splits, milestone conditions
2. **Stream Composition**: Combine multiple streams into one
3. **Stream Transferability**: Allow transfer of stream rights
4. **Advanced Scheduling**: Variable rates, conditional payments
5. **Stream NFTs**: Represent streams as tradeable NFTs