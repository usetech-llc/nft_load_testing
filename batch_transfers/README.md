# Batch Transfer Load Testing

## Prerequisites

1. NodeJS 15
2. Running substrate node with `--dev` option

## Running Tests

```
cd batch_transfers
npm install
node txLoop.js
```

## What Will Happen

The test consists of three parts:

1. Preparation 1 : Generating sender addresses (O(n))
2. Preparation 2 : Crediting senders from Alice balance (O(log(n)))
3. Load : Sending small amounts to Alice from all senders in each block

